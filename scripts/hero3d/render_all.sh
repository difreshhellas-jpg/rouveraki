B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
for A in portrait landscape; do
  "$B" -b --factory-startup --python build_gyros.py -- --aspect $A --scale 0.667 --samples 64 --all --out C:/Users/maggi/rouveraki/scripts/hero3d/out/$A > out/render_$A.log 2>&1
done
echo done > out/render_done.txt
