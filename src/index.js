const formatTime = n => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;

export class VideoComparison {
  constructor(root) {
    this.root = root; this.videos = [...root.querySelectorAll('video')];
    this.playButton = root.querySelector('[data-play]'); this.seek = root.querySelector('[data-seek]');
    this.output = root.querySelector('[data-time]'); this.status = root.querySelector('[data-status]');
    this.speed = root.querySelector('[data-speed]'); this.position = 0; this.playing = false; this.action = 0;
    this.duration = Math.max(...this.videos.map(v => Number(v.dataset.duration)));
    this.playButton.addEventListener('click', () => this.toggle());
    root.querySelector('[data-restart]').addEventListener('click', () => this.jump(0));
    this.seek.addEventListener('input', () => this.jump(Number(this.seek.value)));
    this.speed.addEventListener('change', () => this.videos.forEach(v => v.playbackRate = Number(this.speed.value)));
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); });
    this.videos.forEach(v => v.addEventListener('error', () => { this.pause(); this.status.textContent = 'A recording could not load. Check your connection and press play to retry.'; this.ready = null; }));
    root.comparison = this;
  }
  async load() {
    if (this.ready) return this.ready;
    this.status.textContent = 'Loading recordings…';
    this.ready = Promise.all(this.videos.map(v => new Promise((resolve, reject) => {
      if (v.readyState >= 1 && !v.error) return resolve();
      let timer;
      const cleanup = () => { clearTimeout(timer); v.removeEventListener('loadedmetadata', ok); v.removeEventListener('error', fail); };
      const ok = () => { cleanup(); resolve(); }; const fail = () => { cleanup(); reject(new Error('Video unavailable')); };
      v.addEventListener('loadedmetadata', ok); v.addEventListener('error', fail); timer = setTimeout(fail, 45000);
      v.src = v.dataset.src; v.preload = 'auto'; v.load();
    }))).then(() => {
      this.duration = Math.max(...this.videos.map(v => v.duration));
      this.master = this.videos.reduce((a, b) => a.duration > b.duration ? a : b);
      this.seek.max = this.duration; this.master.addEventListener('ended', () => { this.position = this.duration; this.pause(); this.update(); });
      this.status.textContent = 'Ready. Playback controls apply to every view.';
    }).catch(e => { this.ready = null; throw e; });
    return this.ready;
  }
  pause() {
    this.action++; this.playing = false; cancelAnimationFrame(this.frame);
    this.videos.forEach(v => v.pause()); this.playButton.textContent = 'Play comparison'; this.playButton.setAttribute('aria-pressed', 'false');
  }
  async toggle() {
    if (this.playing) { this.pause(); return; }
    const action = ++this.action; this.playButton.textContent = 'Loading…';
    try {
      await this.load(); if (action !== this.action) return;
      if (this.position >= this.duration - .05) this.position = 0;
      this.align(true); this.playing = true;
      await Promise.all(this.videos.filter(v => this.position < v.duration - .05).map(v => v.play()));
      if (action !== this.action) { this.videos.forEach(v => v.pause()); return; }
      this.playButton.textContent = 'Pause'; this.playButton.setAttribute('aria-pressed', 'true');
      this.status.textContent = 'Playing in sync. Shorter clips hold their final frame.'; this.tick();
    } catch { this.pause(); this.status.textContent = 'Playback could not start. Press play to try again.'; }
  }
  async jump(time) {
    this.pause(); const action = this.action; this.position = Math.max(0, Math.min(time, this.duration)); this.update();
    try { await this.load(); if (action === this.action) { this.align(true); this.status.textContent = 'Paused. Press play to continue from this position.'; } }
    catch { this.status.textContent = 'The recordings could not load. Press play to retry.'; }
  }
  align(force = false) {
    this.videos.forEach(v => {
      const target = Math.min(this.position, Math.max(0, v.duration - .045));
      if (force || Math.abs(v.currentTime - target) > .22) v.currentTime = target;
      v.playbackRate = Number(this.speed.value);
      if (this.position >= v.duration - .045) v.pause();
    });
  }
  update() { this.seek.value = this.position; this.output.textContent = `${formatTime(this.position)} / ${formatTime(this.duration)}`; }
  tick() {
    if (!this.playing) return;
    this.position = this.master.currentTime; this.align(); this.update();
    this.frame = requestAnimationFrame(() => this.tick());
  }
}
document.querySelectorAll('[data-video-group]').forEach(root => new VideoComparison(root));

document.querySelector('#copy-citation').addEventListener('click', async () => {
  const text = document.querySelector('#bibtex-code').textContent; const status = document.querySelector('#copy-status');
  try { await navigator.clipboard.writeText(text); status.textContent = 'Citation copied.'; }
  catch { const range = document.createRange(); range.selectNodeContents(document.querySelector('#bibtex-code')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range); status.textContent = 'Citation selected. Copy it with Ctrl+C or Command+C.'; }
});

const root = document.querySelector('#mesh-comparison');
const sceneSelect = document.querySelector('#scene-select'), methodSelect = document.querySelector('#method-select');
const activate = document.querySelector('#activate-viewer'), status = document.querySelector('#viewer-status');
let manifest, viewer, initializing, revision = 0;
const manifestPromise=fetch('static/data/results.json').then(r=>{if(!r.ok)throw new Error('Manifest unavailable');return r.json();}).then(data=>{manifest=data;if(!viewer&&!initializing)previewStatus();return data;});
manifestPromise.catch(()=>{});
const methodNames = {ts:'Triangle Splatting',milo:'MILo','2dgs':'2DGS','mesh-splat':'Mesh-splat',sugar:'SuGaR · point cloud'};
const sceneNames = {'utmm-fast':'UTMM fast-straight','replica-room0':'Replica room0','ncd-quad':'NCD quad-easy'};
function previewStatus(){const scene=manifest?.scenes[sceneSelect.value];const total=scene?Math.ceil((scene.methods.ours.bytes+scene.methods[methodSelect.value].bytes)/1e6):null;status.textContent=`Preview images. ${total?`Load about ${total} MB to explore this pair in 3D.`:'Press Explore in 3D to load these models.'}${methodSelect.value==='sugar'?' SuGaR shows Gaussian centers, not a surface mesh.':''}`;}
function previews() {
  const scene = sceneSelect.value, method = methodSelect.value;
  document.querySelector('#baseline-label').textContent = methodNames[method];
  for (const [side,id] of [['ours','ours'],['baseline',method]]) {
    const pane = root.querySelector(`[data-side="${side}"]`), img = pane.querySelector('img');
    img.src = `static/images/meshes/${scene}/${id}.jpg`;
    img.alt = `${side === 'ours' ? 'Ours' : methodNames[method]} reconstruction of ${sceneNames[scene]}`;
    img.hidden = false; pane.querySelector('canvas').hidden = true;
  }
}
async function selectPair() {
  const current = ++revision; previews();
  if (!viewer) { previewStatus(); return; }
  status.textContent = 'Loading selected models…'; root.dataset.state = 'loading';
  try {
    await viewer.setPair(manifest.scenes[sceneSelect.value], methodSelect.value);
    if (current !== revision) return;
    status.textContent = methodSelect.value==='sugar'?'Ready. SuGaR shows the supplied Gaussian centers, not an extracted surface mesh.':'Ready. Both views share the same camera.'; root.dataset.state = 'ready';
    activate.hidden = true; document.querySelector('#reset-view').disabled = false;
  } catch(e) {
    if (current !== revision || e.name === 'AbortError') return;
    previews(); root.dataset.state = 'error'; status.textContent = '3D could not load. Preview images remain available. Press Retry 3D to try again.';
    activate.hidden = false; activate.textContent = 'Retry 3D';
  }
}
sceneSelect.addEventListener('change', selectPair); methodSelect.addEventListener('change', selectPair);
activate.addEventListener('click', async () => {
  if (initializing) return;
  initializing = true; activate.disabled = true; status.textContent = 'Starting the 3D viewer…';
  try {
    if (!viewer) {
      const [module, data] = await Promise.all([import('./mesh-viewer.js'),manifestPromise.catch(()=>fetch('static/data/results.json').then(r=>{if(!r.ok)throw new Error('Manifest unavailable');return r.json();}))]);
      manifest=data;
      viewer = new module.MeshComparison(root, {onLost: () => { revision++; previews();root.dataset.state='error';status.textContent='3D rendering stopped. Preview images are available; reload the page to restart 3D.';activate.hidden=true; }});
      root.viewer = viewer;
      viewer.setMode(document.querySelector('[name="display-mode"]:checked').value);
    }
    await selectPair();
  } catch {
    root.dataset.state = 'error'; status.textContent = 'Interactive 3D is unavailable in this browser. You can still compare the preview images.'; activate.textContent = 'Retry 3D';
  } finally { initializing = false; activate.disabled = false; }
});
document.querySelector('#reset-view').addEventListener('click', () => viewer?.reset());
document.querySelectorAll('[name="display-mode"]').forEach(input => input.addEventListener('change', () => {
  if(viewer) viewer.setMode(input.value); else status.textContent = 'Load 3D to switch between color and shaded geometry.';
}));
document.querySelector('#fullscreen-view').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await root.requestFullscreen(); }
  catch { status.textContent = 'Fullscreen is not supported by this browser.'; }
});
document.addEventListener('fullscreenchange', () => { document.querySelector('#fullscreen-view').textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'; });
const links = [...document.querySelectorAll('nav a')];
const sectionObserver=new IntersectionObserver(entries => entries.forEach(entry => { if(entry.isIntersecting) links.forEach(a => { if(a.hash === `#${entry.target.id}`) a.setAttribute('aria-current','location'); else a.removeAttribute('aria-current'); }); }),{rootMargin:'-15% 0px -65% 0px'});
links.forEach(a=>sectionObserver.observe(document.querySelector(a.hash)));
