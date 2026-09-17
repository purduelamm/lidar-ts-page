"""Prepare web media without modifying the source recordings or paper."""
import argparse, json, subprocess, hashlib, shutil
from pathlib import Path
import imageio_ffmpeg

ROOT=Path(__file__).resolve().parents[1]
def run(args):
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-loglevel','error','-y',*map(str,args)],check=True)
def main():
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--paper',type=Path,required=True);p.add_argument('--figures',type=Path,required=True);p.add_argument('--inspect-only',action='store_true');a=p.parse_args()
    cache=ROOT/'.cache/media';cache.mkdir(parents=True,exist_ok=True)
    for name in ['ours_1','ours_2','ours_3','vanilla','GT']:
        for sec in [5,15,25]:
            run(['-ss',sec,'-i',a.source/'application'/f'{name}.mp4','-frames:v',1,'-vf','scale=960:-2',cache/f'{name}-{sec}.jpg'])
    if a.inspect_only:return
    images=ROOT/'static/images';videos=ROOT/'static/videos';pdfs=ROOT/'static/pdfs'
    for d in [images,videos,pdfs]:d.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(a.paper,pdfs/'lidar-triangle-splatting.pdf')
    shutil.copyfile(a.figures/'problem.png',images/'limited-viewpoints.png')
    shutil.copyfile(a.figures/'method.png',images/'pipeline.png')
    sources={'optimization-ours-mesh':'ours.mp4','optimization-ours-rgb':'ours_img.mp4','optimization-ts-mesh':'vanilla.mp4','optimization-ts-rgb':'vanilla_img.mp4','walking-ours':'application/ours_1.mp4','walking-ts':'application/vanilla.mp4','walking-gt':'application/GT.mp4'}
    records=[]
    for dest,src in sources.items():
        out=videos/f'{dest}.mp4';source=a.source/src
        if not out.exists():
            print('Encoding',dest,flush=True)
            run(['-i',source,'-map','0:v:0','-an','-c:v','libx264','-preset','medium','-crf','25','-vf','scale=1280:-2','-pix_fmt','yuv420p','-movflags','+faststart',out])
        run(['-ss',5,'-i',source,'-frames:v',1,'-vf','scale=960:-2',images/f'{dest}.jpg'])
        records.append({'asset':str(out.relative_to(ROOT)).replace('\\','/'),'source':str(source),'bytes':out.stat().st_size,'sourceSha256':hashlib.file_digest(source.open('rb'),'sha256').hexdigest(),'processing':'H.264, CRF 25, 1280px wide, original timing, no audio, faststart'})
    (ROOT/'scripts/media-provenance.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
if __name__=='__main__':main()
