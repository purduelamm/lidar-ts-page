"""Convert supplied SuGaR Gaussian centers to an explicitly labeled point cloud."""
import json,hashlib,argparse
from pathlib import Path
import numpy as np
from plyfile import PlyData
import trimesh
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);args=p.parse_args();base=args.source
for scene,folder in [('replica-room0','replica/room0'),('utmm-fast','UTMM/fast-straight'),('ncd-quad','NCD')]:
 source=base/folder/'mesh_output/sugar.ply';v=PlyData.read(source)['vertex'].data
 vertices=np.column_stack([v[a] for a in ['x','y','z']]);rgb=np.clip(.5+.28209479177387814*np.column_stack([v[f'f_dc_{i}'] for i in range(3)]),0,1)
 # No surface is invented. Preserve all centers and spherical-harmonic DC colors.
 cloud=trimesh.points.PointCloud(vertices,colors=np.round(rgb*255).astype(np.uint8));dest=ROOT/'.cache/meshes'/scene/'sugar.glb';dest.write_bytes(trimesh.Scene(cloud).export(file_type='glb'))
 info={'scene':scene,'method':'sugar','source':str(source),'sourceSha256':hashlib.file_digest(source.open('rb'),'sha256').hexdigest(),'originalVertices':len(v),'originalFaces':0,'displayVertices':len(v),'displayFaces':0,'pointCloud':True,'vertexColors':True,'bounds':np.quantile(vertices,[.01,.99],axis=0).tolist(),'operations':['retain all Gaussian centers','convert SH DC coefficients to RGB','export points without surface reconstruction'],'rawGlbBytes':dest.stat().st_size}
 dest.with_suffix('.json').write_text(json.dumps(info,indent=2));print(scene,len(v),'points',flush=True)
