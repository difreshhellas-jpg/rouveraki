"""Rouveraki scroll-hero: procedural folded pita gyros that unfolds into a floating exploded view.

Run:  blender -b --factory-startup --python build_gyros.py -- --aspect portrait --out DIR
      [--frames 0,30,60 | --all] [--scale 0.5] [--samples 64]
Everything is deterministic: frame i always renders the same image (fixed seeds, no simulation).
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

# ------------------------------------------------------------------ args
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default


ASPECT = arg("--aspect", "portrait")
OUT = arg("--out", os.path.join(os.path.dirname(__file__), "out", ASPECT))
SCALE = float(arg("--scale", "1.0"))
SAMPLES = int(arg("--samples", "96"))
NFRAMES = int(arg("--n", "121"))
if "--all" in argv:
    FRAMES = list(range(NFRAMES))
else:
    FRAMES = [int(x) for x in arg("--frames", "0,30,60,90,120").split(",")]
RES = (1080, 1920) if ASPECT == "portrait" else (1920, 1080)
RES = (int(RES[0] * SCALE) // 2 * 2, int(RES[1] * SCALE) // 2 * 2)


# ------------------------------------------------------------------ helpers
def smoothstep(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def ease(x):  # smootherstep: zero velocity AND acceleration at the ends
    x = min(max(x, 0.0), 1.0)
    return x * x * x * (x * (6 * x - 15) + 10)


def lerp(a, b, t):
    return a + (b - a) * t


rad = math.radians
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"


def link(obj):
    scene.collection.objects.link(obj)
    return obj


def make_mesh(name, verts, faces, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.update()
    if smooth:
        me.shade_smooth()
    return link(bpy.data.objects.new(name, me))


# ------------------------------------------------------------------ materials
def new_mat(name):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m, nt, bsdf


def N(nt, kind, **props):
    n = nt.nodes.new(kind)
    for k, v in props.items():
        setattr(n, k, v)
    return n


def ramp(nt, fac, stops):
    r = N(nt, "ShaderNodeValToRGB")
    els = r.color_ramp.elements
    while len(els) > 2:
        els.remove(els[-1])
    els[0].position, els[0].color = stops[0][0], stops[0][1]
    els[1].position, els[1].color = stops[1][0], stops[1][1]
    for pos, col in stops[2:]:
        e = els.new(pos)
        e.color = col
    nt.links.new(fac, r.inputs["Fac"])
    return r


def objcoord(nt):
    return N(nt, "ShaderNodeTexCoord").outputs["Object"]


def noise(nt, scale, detail=4.0, rough=0.55):
    n = N(nt, "ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = rough
    nt.links.new(objcoord(nt), n.inputs["Vector"])
    return n


def hexc(h, a=1.0):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c]
    return (*lin, a)


def mix_rgb(nt, fac, a, b):
    m = N(nt, "ShaderNodeMix", data_type="RGBA")
    if isinstance(fac, (int, float)):
        m.inputs[0].default_value = fac
    else:
        nt.links.new(fac, m.inputs[0])
    for idx, v in ((6, a), (7, b)):
        if isinstance(v, tuple):
            m.inputs[idx].default_value = v
        else:
            nt.links.new(v, m.inputs[idx])
    return m.outputs[2]


def bump(nt, bsdf, height, strength, dist=0.002):
    b = N(nt, "ShaderNodeBump")
    b.inputs["Strength"].default_value = strength
    b.inputs["Distance"].default_value = dist
    nt.links.new(height, b.inputs["Height"])
    nt.links.new(b.outputs["Normal"], bsdf.inputs["Normal"])


TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tex")


def img_node(nt, name, ext="REPEAT"):
    n = N(nt, "ShaderNodeTexImage")
    n.image = bpy.data.images.load(os.path.join(TEX, name))
    n.extension = ext
    n.interpolation = "Cubic"
    return n


def luminance(nt, color):
    bw = N(nt, "ShaderNodeRGBToBW")
    nt.links.new(color, bw.inputs[0])
    return bw.outputs[0]


def mat_pita():
    m, nt, b = new_mat("pita")
    im = img_node(nt, "pita.png")  # Leonardo macro photo, mapped by the sheet's UVs
    tint = mix_rgb(nt, 0.18, im.outputs["Color"], hexc("#d99a4a"))
    nt.links.new(tint, b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.7
    b.inputs["Subsurface Weight"].default_value = 0.15
    b.inputs["Subsurface Radius"].default_value = (0.9, 0.55, 0.3)
    b.inputs["Subsurface Scale"].default_value = 0.004
    bump(nt, b, luminance(nt, im.outputs["Color"]), 0.5, 0.002)
    return m


def mat_meat():
    m, nt, b = new_mat("gyros")
    # planar projection in object space, offset per slice so no two slices match
    tc = N(nt, "ShaderNodeTexCoord")
    mp = N(nt, "ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (9, 9, 9)
    mp.inputs["Location"].default_value = (0.5, 0.5, 0)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    oi = N(nt, "ShaderNodeObjectInfo")
    cx = N(nt, "ShaderNodeCombineXYZ")
    for k, mul in ((0, 37.0), (1, 23.0)):
        mm = N(nt, "ShaderNodeMath", operation="MULTIPLY")
        nt.links.new(oi.outputs["Random"], mm.inputs[0])
        mm.inputs[1].default_value = mul
        nt.links.new(mm.outputs[0], cx.inputs[k])
    add = N(nt, "ShaderNodeVectorMath", operation="ADD")
    nt.links.new(mp.outputs["Vector"], add.inputs[0])
    nt.links.new(cx.outputs[0], add.inputs[1])
    im = img_node(nt, "gyros.png")
    nt.links.new(add.outputs[0], im.inputs["Vector"])
    # crisp charred rim from object-space distance to the slab centre
    sep = N(nt, "ShaderNodeSeparateXYZ")
    nt.links.new(objcoord(nt), sep.inputs[0])
    ax = N(nt, "ShaderNodeMath", operation="ABSOLUTE")
    nt.links.new(sep.outputs["X"], ax.inputs[0])
    mr = N(nt, "ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.026
    mr.inputs["From Max"].default_value = 0.042
    nt.links.new(ax.outputs[0], mr.inputs["Value"])
    nz = noise(nt, 90, 4, 0.5).outputs["Fac"]
    edge = N(nt, "ShaderNodeMath", operation="MULTIPLY", use_clamp=True)
    nt.links.new(mr.outputs["Result"], edge.inputs[0])
    nt.links.new(nz, edge.inputs[1])
    edge2 = N(nt, "ShaderNodeMath", operation="MULTIPLY", use_clamp=True)
    nt.links.new(edge.outputs[0], edge2.inputs[0])
    edge2.inputs[1].default_value = 1.2
    col = mix_rgb(nt, edge2.outputs[0], im.outputs["Color"], hexc("#24120a"))
    nt.links.new(col, b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.4
    b.inputs["Coat Weight"].default_value = 0.3
    b.inputs["Coat Roughness"].default_value = 0.25
    b.inputs["Subsurface Weight"].default_value = 0.08
    b.inputs["Subsurface Scale"].default_value = 0.003
    bump(nt, b, luminance(nt, im.outputs["Color"]), 0.6, 0.0018)
    return m


def mat_fry():
    m, nt, b = new_mat("fry")
    n1 = noise(nt, 180, 5, 0.6)
    col = ramp(nt, n1.outputs["Fac"], [(0.35, hexc("#c27a24")), (0.55, hexc("#e2a844")), (0.75, hexc("#f2cf72"))])
    nt.links.new(col.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.5
    b.inputs["Subsurface Weight"].default_value = 0.08
    b.inputs["Subsurface Scale"].default_value = 0.002
    bump(nt, b, n1.outputs["Fac"], 0.4, 0.0008)
    return m


def mat_tomato():
    m, nt, b = new_mat("tomato")
    mp = N(nt, "ShaderNodeMapping")
    k = 0.92 / 0.062  # the photographed slice spans ~92% of the frame; the mesh is 0.062 m across
    mp.inputs["Scale"].default_value = (k, k, 1)
    mp.inputs["Location"].default_value = (0.5, 0.5, 0)
    nt.links.new(objcoord(nt), mp.inputs["Vector"])
    im = img_node(nt, "tomato.png", "EXTEND")
    nt.links.new(mp.outputs["Vector"], im.inputs["Vector"])
    nt.links.new(im.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.2
    b.inputs["Coat Weight"].default_value = 0.35
    b.inputs["Subsurface Weight"].default_value = 0.3
    b.inputs["Subsurface Radius"].default_value = (1.0, 0.25, 0.15)
    b.inputs["Subsurface Scale"].default_value = 0.004
    return m


def mat_onion():
    m, nt, b = new_mat("onion")
    n1 = noise(nt, 40, 3, 0.5)
    col = ramp(nt, n1.outputs["Fac"], [(0.3, hexc("#e8c7da")), (0.55, hexc("#f4e4ee")), (0.8, hexc("#c78fb0"))])
    nt.links.new(col.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.28
    b.inputs["Subsurface Weight"].default_value = 0.5
    b.inputs["Subsurface Radius"].default_value = (1.0, 0.5, 0.7)
    b.inputs["Subsurface Scale"].default_value = 0.004
    b.inputs["Coat Weight"].default_value = 0.25
    return m


def mat_tzatziki():
    m, nt, b = new_mat("tzatziki")
    vor = N(nt, "ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 420
    nt.links.new(objcoord(nt), vor.inputs["Vector"])
    speck = ramp(nt, vor.outputs["Distance"], [(0.06, (1, 1, 1, 1)), (0.16, (0, 0, 0, 1))])
    n1 = noise(nt, 60, 2, 0.5)
    cream = ramp(nt, n1.outputs["Fac"], [(0.3, hexc("#e4e0c6")), (0.7, hexc("#f1eddb"))])
    col = mix_rgb(nt, speck.outputs["Color"], cream.outputs["Color"], hexc("#5f8a3a"))
    nt.links.new(col, b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.2
    b.inputs["Coat Weight"].default_value = 0.2
    b.inputs["Coat Roughness"].default_value = 0.2
    b.inputs["Subsurface Weight"].default_value = 0.45
    b.inputs["Subsurface Radius"].default_value = (0.9, 1.0, 0.6)
    b.inputs["Subsurface Scale"].default_value = 0.006
    return m


# ------------------------------------------------------------------ geometry
def grid_faces(nr, nc):
    f = []
    for j in range(nr - 1):
        for i in range(nc - 1):
            a = j * nc + i
            f.append((a, a + 1, a + nc + 1, a + nc))
    return f


R_PITA = 0.1
FOLD = 74.0  # degrees the walls lean up from flat when folded
NR, NCH = 61, 28  # rows along the fold line, columns per side
NC = 2 * NCH + 1


def pita_positions(open_amt):
    """Folded half-moon (open_amt=0) -> flat disc (1). Isometric bend, so the unfold looks physical."""
    gamma = rad(FOLD) * (1 - open_amt)
    y = np.linspace(-R_PITA, R_PITA, NR)
    chord = np.maximum(np.sqrt(np.maximum(R_PITA ** 2 - y ** 2, 1e-8)), 0.0006)
    xi = np.linspace(-1, 1, NC)
    d = np.abs(xi)[None, :] * chord[:, None]
    w = 0.045
    q = (d / w).clip(0, 1)
    th = gamma * q * q * (3 - 2 * q)
    px = np.zeros_like(d)
    pz = np.zeros_like(d)
    right = np.arange(NCH, NC)
    left = np.arange(NCH, -1, -1)
    for side, idx in ((1, right), (-1, left)):
        seg = np.abs(np.diff(d[:, idx], axis=1, prepend=d[:, [NCH]]))
        px[:, idx] = side * np.cumsum(np.cos(th[:, idx]) * seg, axis=1)
        pz[:, idx] = np.cumsum(np.sin(th[:, idx]) * seg, axis=1)
    sgn = np.sign(xi)[None, :]
    rr = np.sqrt((xi[None, :] * chord[:, None]) ** 2 + y[:, None] ** 2) / R_PITA
    pillow = 0.017 * (1 - rr.clip(0, 1) ** 2) ** 0.8 * (1 - open_amt) ** 0.7
    px = px + sgn * np.sin(th) * pillow          # outward = -inside normal
    pz = pz - np.cos(th) * pillow
    Y = np.repeat(y[:, None], NC, axis=1)
    return np.stack([px, Y, pz], axis=-1).reshape(-1, 3)


def torus(R, r, nu=56, nv=12):
    v, f = [], []
    for i in range(nu):
        a = 2 * math.pi * i / nu
        for j in range(nv):
            b = 2 * math.pi * j / nv
            v.append(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b)))
    for i in range(nu):
        for j in range(nv):
            a0 = i * nv + j
            a1 = ((i + 1) % nu) * nv + j
            a2 = ((i + 1) % nu) * nv + (j + 1) % nv
            a3 = i * nv + (j + 1) % nv
            f.append((a0, a1, a2, a3))
    return v, f


def meat_slice(seed):
    rs = np.random.RandomState(seed)
    nu, nv = 26, 12
    L, W = 0.074 + rs.rand() * 0.016, 0.034 + rs.rand() * 0.008
    u = np.linspace(-1, 1, nu)
    v = np.linspace(-1, 1, nv)
    uu, vv = np.meshgrid(u, v)
    ph = rs.rand(4) * 6.28
    wob = 0.12 * np.sin(3.1 * uu + ph[0]) + 0.08 * np.sin(5.3 * vv + ph[1])
    x = uu * L / 2 * (1 + 0.04 * np.sin(4 * vv + ph[2]))
    y = vv * W / 2 * (1 + 0.18 * np.sin(2.3 * uu + ph[3]) * (1 - vv ** 2 * 0.2)) * (1 - 0.35 * uu ** 4)
    z = 0.012 * uu ** 2 + 0.0035 * wob + 0.004 * np.sin(2.2 * uu + 2.0 * vv + ph[0])
    verts = np.stack([x, y, z], axis=-1).reshape(-1, 3)
    return verts, grid_faces(nv, nu)


def tzatziki_dollop(seed, r=0.03):
    rs = np.random.RandomState(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=4, radius=r)
    ph = rs.rand(6) * 6.28
    for v in bm.verts:
        x, y, z = v.co
        zz = z * 0.78 if z < 0 else z * 0.9
        lump = 1 + 0.07 * math.sin(5 * x / r + ph[0]) * math.sin(5 * y / r + ph[1]) + 0.04 * math.sin(9 * z / r + ph[2])
        peak = 0.0
        if z > 0:
            rd = math.hypot(x, y)
            peak = 0.2 * r * math.exp(-(rd / (0.34 * r)) ** 2) * (1 + 0.1 * math.sin(7 * math.atan2(y, x) + ph[3]))
        v.co = Vector((x * lump * 1.08, y * lump * 1.08, zz * lump + peak))
    me = bpy.data.meshes.new("tz")
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    return link(bpy.data.objects.new("tzatziki", me))


def bevel(obj, width=0.0012, seg=2):
    m = obj.modifiers.new("bevel", "BEVEL")
    m.width = width
    m.segments = seg
    m.limit_method = "ANGLE"


def box_mesh(sx, sy, sz):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
    me = bpy.data.meshes.new("fry")
    bm.to_mesh(me)
    bm.free()
    return me


def cyl_mesh(r, h, seg=44):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=h)
    me = bpy.data.meshes.new("slice")
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    return me


# ------------------------------------------------------------------ build scene
M = {k: v() for k, v in dict(pita=mat_pita, meat=mat_meat, fry=mat_fry, tomato=mat_tomato,
                              onion=mat_onion, tz=mat_tzatziki).items()}

pita = make_mesh("pita", pita_positions(0.0), grid_faces(NR, NC))
pita.data.materials.append(M["pita"])
_uv = pita.data.uv_layers.new(name="UV")
_flat = pita_positions(1.0)
_vi = np.empty(len(pita.data.loops), dtype=np.int32)
pita.data.loops.foreach_get("vertex_index", _vi)
_uv.data.foreach_set("uv", np.stack([_flat[_vi, 0] / (2 * R_PITA) + 0.5, _flat[_vi, 1] / (2 * R_PITA) + 0.5], axis=1).ravel())
sol = pita.modifiers.new("solid", "SOLIDIFY")
sol.thickness = 0.0075
sol.offset = 0.0
sub = pita.modifiers.new("sub", "SUBSURF")
sub.levels = 1
sub.render_levels = 2

items = []


def add_item(obj, mat, pc, rc, pf, rf, delay, spin=(0, 0, 0)):
    if mat:
        obj.data.materials.append(M[mat])
    items.append(dict(obj=obj, pc=Vector(pc), rc=Euler(rc), pf=Vector(pf), rf=Euler(rf), delay=delay, spin=Vector(spin)))


def rim_z(yy):
    """Height of the folded pita's top edge at fold-line position yy."""
    return math.sqrt(max(R_PITA ** 2 - yy ** 2, 1e-6)) * math.sin(rad(FOLD)) * 0.92


rs = np.random.RandomState(7)

fry_me = box_mesh(0.0115, 0.0115, 1.0)
nfry = 15
for i in range(nfry):
    o = link(bpy.data.objects.new(f"fry{i}", fry_me))
    bevel(o, 0.0012, 2)
    ln = 0.048 + rs.rand() * 0.028
    o.scale = (1, 1, ln)
    yy = lerp(-0.062, 0.062, i / (nfry - 1)) + rs.randn() * 0.004
    base = (rs.randn() * 0.006, yy, rim_z(yy) - ln * 0.5 + 0.018 + rs.rand() * 0.012)
    tilt = (rad(rs.randn() * 6), rad(rs.randn() * 9), rad(rs.randn() * 25))
    ang = i * 2.399
    rho = 0.06 + 0.09 * rs.rand()
    fl = (rho * math.cos(ang), rho * math.sin(ang), 0.0 + 0.15 * rs.rand())
    rf = (rad(rs.uniform(-25, 25)), rad(rs.uniform(-25, 25)), rad(rs.uniform(0, 180)))
    add_item(o, "fry", base, tilt, fl, rf, 0.02 * i / nfry + 0.1 * rs.rand(),
             (rs.uniform(-.6, .6), rs.uniform(-.6, .6), rs.uniform(-.8, .8)))

for i in range(6):
    v, f = meat_slice(30 + i)
    o = make_mesh(f"meat{i}", v, f)
    s = o.modifiers.new("solid", "SOLIDIFY")
    s.thickness = 0.0055
    s.offset = 0
    yy = lerp(-0.055, 0.055, i / 5)
    side = 1 if i % 2 else -1
    base = (side * 0.006, yy, rim_z(yy) + 0.004)
    rc = (rad(side * 62 + rs.randn() * 6), rad(rs.randn() * 8), rad(90 + rs.randn() * 12))
    ang = i * 1.05 + 0.5
    fl = (0.1 * math.cos(ang), 0.1 * math.sin(ang), 0.03 + 0.07 * rs.rand() + 0.012 * i)
    rf = (rad(rs.uniform(-35, 35)), rad(rs.uniform(-35, 35)), rad(rs.uniform(0, 360)))
    add_item(o, "meat", base, rc, fl, rf, 0.04 + 0.05 * i / 5,
             (rs.uniform(-.3, .3), rs.uniform(-.3, .3), rs.uniform(-.7, .7)))

tom_me = cyl_mesh(0.031, 0.0085)
for i in range(3):
    o = link(bpy.data.objects.new(f"tomato{i}", tom_me))
    bevel(o, 0.0013, 2)
    yy = (-0.042, 0.0, 0.042)[i]
    base = (0.0, yy, rim_z(yy) - 0.004)
    rc = (0, rad(90 + rs.uniform(-6, 6)), rad(rs.uniform(-8, 8)))
    ang = 2.2 + i * 2.05
    fl = (0.09 * math.cos(ang), 0.09 * math.sin(ang), 0.05 + 0.045 * i)
    rf = (rad(rs.uniform(-20, 20)), rad(rs.uniform(-20, 20)), rad(rs.uniform(0, 360)))
    add_item(o, "tomato", base, rc, fl, rf, 0.07 + 0.04 * i,
             (rs.uniform(-.5, .5), rs.uniform(-.5, .5), rs.uniform(-.5, .5)))

for i in range(5):
    v, f = torus(0.021 + 0.004 * (i % 3), 0.0046)
    o = make_mesh(f"onion{i}", v, f)
    o.scale = (1, 1, 1.15)
    yy = lerp(-0.05, 0.05, i / 4)
    base = (rs.uniform(-0.004, 0.004), yy, rim_z(yy) + 0.002)
    rc = (0, rad(90 + rs.uniform(-12, 12)), rad(rs.uniform(-10, 10)))
    ang = 0.9 + i * 1.3
    fl = (0.11 * math.cos(ang), 0.11 * math.sin(ang), 0.02 + 0.04 * i)
    rf = (rad(rs.uniform(-25, 25)), rad(rs.uniform(-25, 25)), rad(rs.uniform(0, 360)))
    add_item(o, "onion", base, rc, fl, rf, 0.06 + 0.04 * i / 4,
             (rs.uniform(-.8, .8), rs.uniform(-.8, .8), rs.uniform(-.8, .8)))

for i, (rr, fl, delay) in enumerate([(0.022, (-0.05, -0.09, 0.14), 0.05),
                                      (0.018, (0.1, 0.04, 0.09), 0.12),
                                      (0.014, (-0.02, 0.1, 0.19), 0.18)]):
    o = tzatziki_dollop(80 + i, rr)
    o.data.materials.append(M["tz"])
    yy = (-0.05, 0.03, 0.065)[i]
    add_item(o, None, (0.0, yy, rim_z(yy) + rr * 0.15), (0, 0, rad(30 * i)), fl,
             (rad(rs.uniform(-12, 12)), rad(rs.uniform(-12, 12)), rad(rs.uniform(0, 360))), delay, (0.15, 0.1, 0.5))


# ------------------------------------------------------------------ lights, world, camera
def area(name, loc, energy, size, color, target=(0, 0, 0.06), size_y=None):
    L = bpy.data.lights.new(name, "AREA")
    L.energy, L.size, L.color, L.shape = energy, size, color, "RECTANGLE"
    if size_y:
        L.size_y = size_y
    o = link(bpy.data.objects.new(name, L))
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o


area("key", (-0.55, -0.7, 0.75), 55, 0.55, (1.0, 0.9, 0.78), size_y=0.38)
area("rim", (0.62, 0.78, 0.38), 75, 0.4, (1.0, 0.72, 0.4), size_y=0.9)
area("rim2", (-0.9, 0.55, 0.2), 28, 0.35, (0.85, 0.82, 0.95), size_y=0.8)
area("top", (0.1, -0.1, 1.25), 22, 0.9, (1, 0.96, 0.9), size_y=0.9)
area("fill", (0.8, -0.65, -0.15), 14, 0.9, (0.78, 0.84, 1.0), size_y=0.5)

world = bpy.data.worlds.new("w")
scene.world = world
try:
    world.use_nodes = True
except Exception:
    pass
bg = world.node_tree.nodes.get("Background") or world.node_tree.nodes.new("ShaderNodeBackground")
bg.inputs["Color"].default_value = (0.05, 0.042, 0.035, 1)
bg.inputs["Strength"].default_value = 0.35

cam_d = bpy.data.cameras.new("cam")
cam_d.lens = 70
cam_d.sensor_fit = "AUTO"
cam_d.clip_start, cam_d.clip_end = 0.05, 20
cam = link(bpy.data.objects.new("cam", cam_d))
scene.camera = cam

# ------------------------------------------------------------------ render settings
r = scene.render
r.engine = "CYCLES"
r.resolution_x, r.resolution_y = RES
r.resolution_percentage = 100
r.film_transparent = True
r.image_settings.file_format = "PNG"
r.image_settings.color_mode = "RGBA"
r.image_settings.color_depth = "8"
cy = scene.cycles
cy.samples = SAMPLES
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.02
cy.use_denoising = True
try:
    cy.denoiser = "OPENIMAGEDENOISE"
except Exception:
    pass
cy.max_bounces = 8
cy.glossy_bounces = 6
cy.transmission_bounces = 4
cy.sample_clamp_indirect = 8
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "CUDA"
    prefs.get_devices()
    for dev in prefs.devices:
        dev.use = dev.type == "CUDA"
    cy.device = "GPU"
except Exception as e:
    print("GPU setup failed, CPU:", e)
vs = scene.view_settings
for tm in ("Khronos PBR Neutral", "AgX"):
    try:
        vs.view_transform = tm
        break
    except Exception:
        continue

# ------------------------------------------------------------------ the shot (t in 0..1)
T_OPEN0, T_OPEN1 = 0.40, 0.74
D_CLOSED = float(arg("--dclosed", "0.98" if ASPECT == "portrait" else "1.0"))
D_OPEN = float(arg("--dopen", "1.42" if ASPECT == "portrait" else "1.45"))
cam_d.shift_y = float(arg("--shifty", "-0.07" if ASPECT == "portrait" else "0.0"))


def set_state(t):
    o_raw = min(max((t - T_OPEN0) / (T_OPEN1 - T_OPEN0), 0.0), 1.0)
    unfold = ease(min(max((o_raw - 0.06) / 0.62, 0.0), 1.0))
    pita.data.vertices.foreach_set("co", pita_positions(unfold).ravel())
    pita.data.update()
    pita.location = (0, 0, lerp(-0.05, -0.035, unfold) + 0.004 * math.sin(2 * math.pi * t * 2.0) * unfold)
    pita.rotation_euler = (rad(lerp(0, -14, unfold)), 0, rad(lerp(0, 40, unfold)) + rad(10) * math.sin(math.pi * t))
    pm = Matrix.LocRotScale(pita.location, Euler(pita.rotation_euler), Vector((1, 1, 1)))
    for it in items:
        e = ease((o_raw - it["delay"]) / max(1 - it["delay"] - 0.25, 0.2))
        o = it["obj"]
        pc_world = pm @ it["pc"]
        rc_q = (pm.to_3x3() @ it["rc"].to_matrix()).to_quaternion()
        pf = it["pf"].copy()
        pf.z += 0.006 * math.sin(2 * math.pi * (t * 1.6 + it["delay"] * 7)) * e
        pos = pc_world.lerp(pf, e)
        pos.z += 0.04 * math.sin(math.pi * e)
        rot_f = Euler((it["rf"].x + it["spin"].x * e * 0.9 + 0.12 * math.sin(2 * math.pi * t * 1.2 + it["delay"] * 5) * e,
                       it["rf"].y + it["spin"].y * e * 0.9,
                       it["rf"].z + it["spin"].z * e * 1.2 + 0.2 * t))
        o.location = pos
        o.rotation_mode = "QUATERNION"
        o.rotation_quaternion = rc_q.slerp(rot_f.to_quaternion(), e)
    orbit = ease(min(t / 0.46, 1.0))
    az = rad(-38 + 360 * orbit + 52 * smoothstep((t - 0.46) / 0.54))
    el = rad(lerp(7, 15, smoothstep(t / 0.46)) + 9 * smoothstep((t - 0.46) / 0.54))
    dist = lerp(D_CLOSED, D_OPEN, ease((t - 0.36) / 0.40)) * (1 + 0.05 * smoothstep((t - 0.76) / 0.24))
    tz = lerp(0.0, 0.045, ease((t - 0.36) / 0.40))
    target = Vector((0, 0, tz))
    cam.location = target + Vector((dist * math.cos(el) * math.sin(az), -dist * math.cos(el) * math.cos(az), dist * math.sin(el)))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()


os.makedirs(OUT, exist_ok=True)
for fi in FRAMES:
    set_state(fi / (NFRAMES - 1))
    scene.render.filepath = os.path.join(OUT, f"f_{fi + 1:04d}.png")
    bpy.ops.render.render(write_still=True)
    print("rendered", fi, flush=True)
