"""Build display meshes. Source PLYs are read-only; no hole filling or remeshing."""
import argparse, gc, hashlib, json, time
from pathlib import Path
import numpy as np
import pymeshlab as ml
import trimesh
from scipy.spatial import cKDTree

ROOT=Path(__file__).resolve().parents[1]
SCENES={
 'replica-room0':('replica/room0','Replica · room0','ours_var'),
 'utmm-fast':('UTMM/fast-straight','UTMM · fast-straight','ours_var'),
 'ncd-quad':('NCD','NCD · quad-easy','0_ours'),
}
METHODS={'ours':'Ours','ts':'Triangle Splatting','milo':'MILo','2dgs':'2DGS','mesh-splat':'Mesh-splat','sugar':'SuGaR'}
def source_name(scene,method,ours):
 return ours if method=='ours' else {'ts':'TS' if scene=='ncd-quad' else 'triangle','mesh-splat':'mesh_splat' if scene=='ncd-quad' else 'mesh_splatting'}.get(method,method)
def build(base,scene,method,target,reference=False):
 rel,label,ours=SCENES[scene];source=base/rel/'mesh_output'/(source_name(scene,method,ours)+'.ply')
 out=ROOT/'.cache/meshes'/scene;out.mkdir(parents=True,exist_ok=True)
 dest=out/(method+('-reference' if reference else '')+'.glb');record=dest.with_suffix('.json')
 if dest.exists() and record.exists():print('Cached',scene,method,flush=True);return
 started=time.time();print('Loading',scene,method,round(source.stat().st_size/1e6),'MB',flush=True)
 ms=ml.MeshSet();ms.load_new_mesh(str(source));m=ms.current_mesh()
 original_vertices=m.vertex_number();original_faces=m.face_number()
 if original_faces==0:
  print('No surface faces:',scene,method,'Use prepare_sugar.py for an explicitly labeled point cloud.',flush=True)
  return
 # Use original coordinates for every method; derive framing from Ours only.
 verts=m.vertex_matrix();colors=m.vertex_color_matrix() if m.has_vertex_color() else None
 bounds=np.quantile(verts,[.01,.99],axis=0).tolist();raw_bounds=[verts.min(0).tolist(),verts.max(0).tolist()]
 # Keep an evenly distributed source sample for displacement diagnostics.
 rng=np.random.default_rng(2026);sample_ids=rng.choice(len(verts),min(100000,len(verts)),replace=False);sample=verts[sample_ids].copy()
 # Preserve RGB using nearest original vertex after geometric decimation.
 color_tree=cKDTree(verts) if colors is not None and not reference else None
 if not reference:
  ms.meshing_remove_duplicate_vertices()
  if ms.current_mesh().face_number()>target:
   print('Decimating',scene,method,'faces',original_faces,flush=True)
   ms.meshing_decimation_quadric_edge_collapse(targetfacenum=target,preserveboundary=True,preservenormal=True,preservetopology=True,qualitythr=.3,optimalplacement=True,autoclean=False)
  ms.meshing_remove_unreferenced_vertices()
 m=ms.current_mesh();v=m.vertex_matrix();f=m.face_matrix()
 if colors is None:c=np.full((len(v),4),[.7,.7,.7,1.])
 elif reference:c=colors
 else:c=colors[color_tree.query(v,workers=2)[1]]
 rgb=np.round(np.clip(c,0,1)*255).astype(np.uint8);rgb[:,3]=255
 mesh=trimesh.Trimesh(vertices=v,faces=f,vertex_colors=rgb,process=False)
 dest.write_bytes(mesh.export(file_type='glb',include_normals=False))
 result={'scene':scene,'method':method,'source':str(source),'sourceSha256':hashlib.file_digest(source.open('rb'),'sha256').hexdigest(),'originalVertices':original_vertices,'originalFaces':original_faces,'displayVertices':len(v),'displayFaces':len(f),'targetFaces':target,'bounds':bounds,'rawBounds':raw_bounds,'vertexColors':colors is not None,'transform':'identity; shared scene camera; Z up','operations':[] if reference else ['merge exact duplicate vertices','quadric edge collapse preserving boundary, normals, topology','remove unreferenced vertices','transfer nearest original vertex RGB'],'seconds':round(time.time()-started,2),'rawGlbBytes':dest.stat().st_size}
 record.write_text(json.dumps(result,indent=2),encoding='utf-8');print('Done',scene,method,len(f),'faces',round(time.time()-started,1),'seconds',flush=True)
 del mesh,ms,verts,colors,color_tree,v,f;gc.collect()
def main():
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--scene',choices=SCENES);p.add_argument('--method',choices=METHODS);p.add_argument('--target',type=int,default=500000);p.add_argument('--reference',action='store_true');a=p.parse_args()
 for scene in [a.scene] if a.scene else SCENES:
  for method in [a.method] if a.method else METHODS:build(a.source,scene,method,a.target,a.reference)
if __name__=='__main__':main()
