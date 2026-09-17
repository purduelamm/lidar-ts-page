"""Constrain a decimated display mesh to original vertex locations for fidelity."""
import json,sys,time
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree
from plyfile import PlyData
import trimesh
root=Path(__file__).resolve().parents[1];scene,method=sys.argv[1:3];p=root/'.cache/meshes'/scene/f'{method}.glb';j=p.with_suffix('.json');info=json.loads(j.read_text())
v=PlyData.read(info['source'])['vertex'].data;original=np.column_stack([v[k] for k in ['x','y','z']]);print('Building original vertex lookup',len(original),flush=True)
m=trimesh.load(p,force='mesh',process=False);tree=cKDTree(original);distance,ids=tree.query(m.vertices,workers=4)
print('Vertex displacement quantiles',np.quantile(distance,[.5,.9,.99,1]),flush=True)
m.vertices=original[ids];p.write_bytes(m.export(file_type='glb',include_normals=False));info['operations'].append('constrain optimized vertex positions to nearest original source vertices');info['preConstraintDisplacementQuantiles']=np.quantile(distance,[.5,.9,.99,1]).tolist();j.write_text(json.dumps(info,indent=2))
(root/'.cache/validation'/f'{scene}-{method}.json').unlink(missing_ok=True)
print('Constrained display mesh saved.',flush=True)
