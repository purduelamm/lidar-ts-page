"""Render original and display meshes from identical cameras for visual QA."""
import json,gc,time
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
import vtk
from vtk.util.numpy_support import vtk_to_numpy
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'.cache/validation';out.mkdir(parents=True,exist_ok=True)
manifest=json.loads((ROOT/'static/data/results.json').read_text());records=json.loads((ROOT/'scripts/mesh-provenance.json').read_text())
def render(file,camera):
 if file.suffix=='.ply':
  reader=vtk.vtkPLYReader();reader.SetFileName(str(file));reader.Update();poly=reader.GetOutput()
 else:
  reader=vtk.vtkGLTFReader();reader.SetFileName(str(file));reader.Update();extract=vtk.vtkCompositeDataGeometryFilter();extract.SetInputConnection(reader.GetOutputPort());extract.Update();poly=extract.GetOutput()
 mapper=vtk.vtkPolyDataMapper();mapper.SetInputData(poly);mapper.SetColorModeToDirectScalars();mapper.ScalarVisibilityOn()
 actor=vtk.vtkActor();actor.SetMapper(mapper);actor.GetProperty().SetAmbient(1);actor.GetProperty().SetDiffuse(0);actor.GetProperty().SetSpecular(0)
 renderer=vtk.vtkRenderer();renderer.SetBackground(240/255,241/255,237/255);renderer.AddActor(actor)
 cam=renderer.GetActiveCamera();cam.SetPosition(camera['position']);cam.SetFocalPoint(camera['target']);cam.SetViewUp(camera['up']);cam.SetViewAngle(42);cam.SetClippingRange(camera['near'],camera['far'])
 window=vtk.vtkRenderWindow();window.SetOffScreenRendering(1);window.SetSize(720,600);window.SetMultiSamples(0);window.AddRenderer(renderer);window.Render()
 grab=vtk.vtkWindowToImageFilter();grab.SetInput(window);grab.SetInputBufferTypeToRGB();grab.ReadFrontBufferOff();grab.Update();data=vtk_to_numpy(grab.GetOutput().GetPointData().GetScalars()).reshape(600,720,3)[::-1].copy()
 window.Finalize();del renderer,window,mapper,actor,reader,poly;gc.collect();return data
report=[]
for rec in records:
 if rec.get('pointCloud'):continue
 name=rec['scene']+'-'+rec['method'];dest=out/(name+'.jpg');stats=out/(name+'.json')
 if stats.exists():report.append(json.loads(stats.read_text()));continue
 print('Validating',name,flush=True);camera=manifest['scenes'][rec['scene']]['camera'];a=render(Path(rec['source']),camera);b=render(ROOT/'.cache/meshes'/rec['scene']/(rec['method']+'.glb'),camera)
 im=Image.new('RGB',(1440,630),'white');im.paste(Image.fromarray(a),(0,30));im.paste(Image.fromarray(b),(720,30));d=ImageDraw.Draw(im);d.text((10,8),name+' ORIGINAL',fill='black');d.text((730,8),'WEB DISPLAY (before compression)',fill='black');im.save(dest,quality=90)
 bg=np.array([240,241,237]);mask_a=np.max(abs(a.astype(float)-bg),2)>5;mask_b=np.max(abs(b.astype(float)-bg),2)>5
 result={'scene':rec['scene'],'method':rec['method'],'meanPixelDifference':float(np.mean(abs(a.astype(float)-b.astype(float)))),'silhouetteChangedFraction':float(np.mean(mask_a!=mask_b)),'originalFaces':rec['originalFaces'],'displayFaces':rec['displayFaces'],'sameCamera':True}
 stats.write_text(json.dumps(result,indent=2));report.append(result);print(result,flush=True)
(out/'report.json').write_text(json.dumps(report,indent=2))
