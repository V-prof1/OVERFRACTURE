(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const fmt = n => {
    if (n < 1000) return Math.floor(n).toString();
    const units=['K','M','B','T','Qa','Qi','Sx','Sp','Oc','No','Dc'];
    let i=-1; while(n>=1000 && i<units.length-1){n/=1000;i++;}
    return `${n>=100? n.toFixed(0):n>=10?n.toFixed(1):n.toFixed(2)}${units[i]}`;
  };

  const SAVE_KEY='overfracture_web_v01';
  const defaults={flux:0,shards:0,fractures:0,bestTime:0,bossKills:0,sound:true,up:{tap:0,auto:0,damage:0,vitality:0}};
  let save=load();
  function load(){try{return {...defaults,...JSON.parse(localStorage.getItem(SAVE_KEY)||'{}'),up:{...defaults.up,...(JSON.parse(localStorage.getItem(SAVE_KEY)||'{}').up||{})}}}catch{return structuredClone(defaults)}}
  function persist(){localStorage.setItem(SAVE_KEY,JSON.stringify(save))}

  const upgrades={
    tap:{name:'Core Power',icon:'⚡',desc:'Aumenta o Flux gerado por toque.',base:15,growth:1.62},
    auto:{name:'Auto Reactor',icon:'⏱️',desc:'Gera Flux automaticamente a cada segundo.',base:60,growth:1.72},
    damage:{name:'Rift Weaponry',icon:'✦',desc:'Aumenta o dano inicial dentro das runs.',base:180,growth:1.78},
    vitality:{name:'Void Skin',icon:'⬢',desc:'Aumenta a vida máxima nas runs.',base:240,growth:1.82}
  };
  const globalMult=()=>1+save.fractures*.18+save.shards*.025;
  const tapPower=()=> (1+save.up.tap*1.35)*globalMult();
  const autoPower=()=> save.up.auto*1.1*globalMult();
  const cost=id=>Math.floor(upgrades[id].base*Math.pow(upgrades[id].growth,save.up[id]));
  const fractureReq=()=>10000*Math.pow(5,save.fractures);
  const fractureReward=()=>Math.max(1,Math.floor(Math.pow(save.flux/fractureReq(),.55)*(1+save.fractures*.15)));

  function renderHub(){
    $('#fluxText').textContent=fmt(save.flux); $('#shardText').textContent=fmt(save.shards); $('#fractureText').textContent=save.fractures;
    $('#multText').textContent=`x${globalMult().toFixed(2)}`; $('#perTapText').textContent=`+${fmt(tapPower())} Flux`;
    $('#bestTimeText').textContent=`${Math.floor(save.bestTime)}s`; $('#bossKillsText').textContent=save.bossKills;
    $('#fractureReqText').textContent=`${fmt(fractureReq())} Flux`; $('#fractureRewardText').textContent=`+${fmt(fractureReward())} Shard${fractureReward()>1?'s':''}`;
    $('#fractureBtn').disabled=save.flux<fractureReq();
    buildUpgrades();
  }
  function buildUpgrades(){
    const grid=$('#upgradeGrid'); grid.innerHTML='';
    Object.entries(upgrades).forEach(([id,u])=>{
      const c=cost(id); const el=document.createElement('article'); el.className='upgrade-card';
      el.innerHTML=`<div class="icon">${u.icon}</div><h3>${u.name}</h3><p>${u.desc}</p><div class="lvl">LEVEL ${save.up[id]}</div><button ${save.flux<c?'disabled':''}>UPGRADE · ${fmt(c)}</button>`;
      el.querySelector('button').onclick=()=>{if(save.flux<c)return;save.flux-=c;save.up[id]++;persist();renderHub();tone(420,.04)}; grid.appendChild(el);
    });
  }

  $('#core').addEventListener('pointerdown',e=>{
    const crit=Math.random()<.08; const gain=tapPower()*(crit?5:1); save.flux+=gain; persist(); renderHub();
    const f=document.createElement('span'); f.className='float-num'+(crit?' crit':''); f.textContent=`+${fmt(gain)}${crit?' CRIT':''}`;
    const r=$('.core-panel').getBoundingClientRect(); f.style.left=`${e.clientX-r.left-18}px`;f.style.top=`${e.clientY-r.top-10}px`;$('#floatLayer').appendChild(f);setTimeout(()=>f.remove(),780); tone(crit?720:260,crit?.08:.035);
  });
  $('#fractureBtn').onclick=()=>{if(save.flux<fractureReq())return;const reward=fractureReward();save.shards+=reward;save.fractures++;save.flux=0;save.up.tap=0;save.up.auto=0;persist();renderHub();tone(120,.16)};
  $('#soundBtn').onclick=()=>{save.sound=!save.sound;$('#soundBtn').textContent=save.sound?'🔊':'🔈';persist()};
  setInterval(()=>{const a=autoPower();if(a>0){save.flux+=a;persist();renderHub()}},1000);

  let audioCtx=null; function tone(freq,d=.05){if(!save.sound)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=freq;o.type='triangle';g.gain.setValueAtTime(.035,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+d);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+d)}catch{}}

  const canvas=$('#gameCanvas'),ctx=canvas.getContext('2d'); let run=null,raf=0,last=0,keys={},pointer={active:false,x:0,y:0,sx:0,sy:0};
  const mutationPool=[
    {icon:'✦',name:'Overclock',desc:'+35% weapon damage',apply:r=>r.damage*=1.35},
    {icon:'➹',name:'Rapid Pulse',desc:'+28% fire rate',apply:r=>r.fireRate*=1.28},
    {icon:'◉',name:'Split Shot',desc:'+1 projectile',apply:r=>r.projectiles=Math.min(5,r.projectiles+1)},
    {icon:'⬢',name:'Void Skin',desc:'+30 max HP and heal 30',apply:r=>{r.maxHp+=30;r.hp=Math.min(r.maxHp,r.hp+30)}},
    {icon:'💨',name:'Phase Legs',desc:'+18% move speed',apply:r=>r.speed*=1.18},
    {icon:'✺',name:'Critical Rift',desc:'+10% crit chance',apply:r=>r.crit=Math.min(.65,r.crit+.10)},
    {icon:'☄',name:'Heavy Core',desc:'+70% damage, -15% fire rate',apply:r=>{r.damage*=1.7;r.fireRate*=.85}},
    {icon:'⚕',name:'Leech',desc:'Heal 2 HP every 10 kills',apply:r=>r.leech+=2}
  ];
  function resize(){const dpr=Math.min(2,devicePixelRatio||1);canvas.width=innerWidth*dpr;canvas.height=innerHeight*dpr;canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}
  addEventListener('resize',resize);resize();

  function startRun(){
    const hp=100+save.up.vitality*15+save.shards*1.2; run={active:true,t:0,lastSpawn:0,lastShot:0,kills:0,level:1,xp:0,xpNeed:8,maxHp:hp,hp,speed:185,damage:12+save.up.damage*4+save.fractures*2,fireRate:2.2,projectiles:1,crit:.06,leech:0,dashCd:0,dashTime:0,invuln:0,px:innerWidth/2,py:innerHeight/2,enemies:[],shots:[],gems:[],particles:[],bossSpawned:false,bossDead:false,paused:false};
    $('#hub').classList.remove('active');$('#runScreen').classList.add('active');$('#choiceModal').classList.add('hidden');$('#resultModal').classList.add('hidden');last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);tone(180,.12)
  }
  $('#startRunBtn').onclick=startRun; $('#leaveRunBtn').onclick=()=>endRun(false,true); $('#dashBtn').onclick=dash;
  addEventListener('keydown',e=>keys[e.key.toLowerCase()]=true);addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
  canvas.addEventListener('pointerdown',e=>{pointer.active=true;pointer.sx=e.clientX;pointer.sy=e.clientY;pointer.x=e.clientX;pointer.y=e.clientY;canvas.setPointerCapture?.(e.pointerId)});
  canvas.addEventListener('pointermove',e=>{if(pointer.active){pointer.x=e.clientX;pointer.y=e.clientY}});canvas.addEventListener('pointerup',()=>pointer.active=false);canvas.addEventListener('pointercancel',()=>pointer.active=false);
  function dash(){if(!run||run.paused||run.dashCd>0)return;run.dashCd=2.5;run.dashTime=.16;run.invuln=.25;tone(520,.06);$('#dashBtn').classList.add('cooldown')}

  function loop(now){if(!run?.active)return;let dt=Math.min(.033,(now-last)/1000);last=now;if(!run.paused){update(dt);draw()}raf=requestAnimationFrame(loop)}
  function update(dt){
    run.t+=dt;run.dashCd=Math.max(0,run.dashCd-dt);run.dashTime=Math.max(0,run.dashTime-dt);run.invuln=Math.max(0,run.invuln-dt);if(run.dashCd<=0)$('#dashBtn').classList.remove('cooldown');
    let dx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),dy=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);
    if(pointer.active){const pdx=pointer.x-pointer.sx,pdy=pointer.y-pointer.sy,mag=Math.hypot(pdx,pdy);if(mag>8){dx=pdx/mag;dy=pdy/mag}}
    const mag=Math.hypot(dx,dy)||1, sp=run.speed*(run.dashTime>0?3.3:1);run.px+=dx/mag*sp*dt;run.py+=dy/mag*sp*dt;run.px=Math.max(25,Math.min(innerWidth-25,run.px));run.py=Math.max(35,Math.min(innerHeight-25,run.py));
    const interval=Math.max(.18,.82-run.t*.004); if(run.t-run.lastSpawn>interval){run.lastSpawn=run.t;spawnEnemy()}
    if(run.t>60&&!run.bossSpawned){run.bossSpawned=true;spawnBoss()}
    if(run.t-run.lastShot>1/run.fireRate){run.lastShot=run.t;shoot()}
    for(let i=run.enemies.length-1;i>=0;i--){const e=run.enemies[i],d=Math.hypot(run.px-e.x,run.py-e.y)||1;e.x+=(run.px-e.x)/d*e.speed*dt;e.y+=(run.py-e.y)/d*e.speed*dt;if(d<e.r+14&&run.invuln<=0){run.hp-=e.damage;run.invuln=.45;burst(run.px,run.py,'#ff526d',10);tone(90,.06);if(run.hp<=0){endRun(false);return}}}
    for(let i=run.shots.length-1;i>=0;i--){const s=run.shots[i];s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;if(s.life<=0){run.shots.splice(i,1);continue}let hit=false;for(let j=run.enemies.length-1;j>=0;j--){const e=run.enemies[j];if(Math.hypot(s.x-e.x,s.y-e.y)<e.r+s.r){e.hp-=s.dmg;burst(s.x,s.y,s.crit?'#ffd36a':'#26e2ff',4);run.shots.splice(i,1);hit=true;if(e.hp<=0)killEnemy(j,e);break}}if(hit)continue}
    for(let i=run.gems.length-1;i>=0;i--){const g=run.gems[i],d=Math.hypot(run.px-g.x,run.py-g.y);if(d<110){g.x+=(run.px-g.x)*dt*6;g.y+=(run.py-g.y)*dt*6}if(d<22){run.xp+=g.v;run.gems.splice(i,1);if(run.xp>=run.xpNeed)levelUp();}}
    for(let i=run.particles.length-1;i>=0;i--){const p=run.particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life<=0)run.particles.splice(i,1)}
    if(run.t>=90){endRun(true);return}renderRunHUD();
  }
  function spawnEnemy(){const edge=Math.floor(Math.random()*4),m=45,x=edge===0?-m:edge===1?innerWidth+m:Math.random()*innerWidth,y=edge===2?-m:edge===3?innerHeight+m:Math.random()*innerHeight;const scale=1+run.t/70;const elite=Math.random()<Math.min(.18,run.t/350);run.enemies.push({x,y,r:elite?18:12,hp:(elite?46:18)*scale,maxHp:(elite?46:18)*scale,speed:(elite?74:88)+run.t*.28,damage:elite?18:9,elite,boss:false})}
  function spawnBoss(){const hp=650*(1+save.fractures*.18);run.enemies.push({x:innerWidth/2,y:-70,r:40,hp,maxHp:hp,speed:52,damage:28,elite:true,boss:true});tone(70,.3)}
  function shoot(){if(!run.enemies.length)return;let target=run.enemies[0],bd=Infinity;for(const e of run.enemies){const d=Math.hypot(e.x-run.px,e.y-run.py);if(d<bd){bd=d;target=e}}const base=Math.atan2(target.y-run.py,target.x-run.px),count=run.projectiles;for(let i=0;i<count;i++){const spread=(i-(count-1)/2)*.13,ang=base+spread,crit=Math.random()<run.crit,dm=run.damage*(crit?2.2:1);run.shots.push({x:run.px,y:run.py,vx:Math.cos(ang)*520,vy:Math.sin(ang)*520,life:1.3,r:crit?5:4,dmg:dm,crit})}}
  function killEnemy(i,e){run.enemies.splice(i,1);run.kills++;run.gems.push({x:e.x,y:e.y,v:e.boss?12:e.elite?3:1});if(run.leech>0&&run.kills%10===0)run.hp=Math.min(run.maxHp,run.hp+run.leech);if(e.boss){run.bossDead=true;save.bossKills++;persist();burst(e.x,e.y,'#8d5cff',28);tone(880,.18)}}
  function levelUp(){run.xp-=run.xpNeed;run.level++;run.xpNeed=Math.ceil(run.xpNeed*1.28+3);run.paused=true;showChoices()}
  function showChoices(){const picks=[...mutationPool].sort(()=>Math.random()-.5).slice(0,3),grid=$('#choiceGrid');grid.innerHTML='';picks.forEach(m=>{const b=document.createElement('button');b.className='choice';b.innerHTML=`<div class="cicon">${m.icon}</div><h3>${m.name}</h3><p>${m.desc}</p>`;b.onclick=()=>{m.apply(run);$('#choiceModal').classList.add('hidden');run.paused=false;tone(620,.08)};grid.appendChild(b)});$('#choiceModal').classList.remove('hidden')}
  function burst(x,y,color,n){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=35+Math.random()*120;run.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.2+Math.random()*.35,color})}}
  function renderRunHUD(){const hp=Math.max(0,run.hp);$('#hpText').textContent=`${Math.ceil(hp)}/${Math.ceil(run.maxHp)}`;$('#hpBar').style.width=`${hp/run.maxHp*100}%`;const m=Math.floor(run.t/60),s=Math.floor(run.t%60).toString().padStart(2,'0');$('#timerText').textContent=`${m}:${s}`;$('#waveText').textContent=run.bossSpawned&&!run.bossDead?'BOSS FRACTURE':`WAVE ${1+Math.floor(run.t/15)}`;$('#runLevelText').textContent=run.level;$('#killsText').textContent=run.kills;$('#xpBar').style.width=`${Math.min(100,run.xp/run.xpNeed*100)}%`}
  function draw(){ctx.clearRect(0,0,innerWidth,innerHeight);const g=ctx.createRadialGradient(run.px,run.py,40,run.px,run.py,Math.max(innerWidth,innerHeight));g.addColorStop(0,'#11162a');g.addColorStop(.5,'#090c15');g.addColorStop(1,'#040509');ctx.fillStyle=g;ctx.fillRect(0,0,innerWidth,innerHeight);ctx.strokeStyle='rgba(141,92,255,.06)';ctx.lineWidth=1;const size=48,ox=(-run.px*.08)%size,oy=(-run.py*.08)%size;for(let x=ox;x<innerWidth;x+=size){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,innerHeight);ctx.stroke()}for(let y=oy;y<innerHeight;y+=size){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(innerWidth,y);ctx.stroke()}
    for(const g of run.gems){ctx.fillStyle='#8d5cff';ctx.shadowBlur=12;ctx.shadowColor='#8d5cff';ctx.beginPath();ctx.arc(g.x,g.y,4+Math.min(5,g.v),0,Math.PI*2);ctx.fill()}ctx.shadowBlur=0;
    for(const s of run.shots){ctx.fillStyle=s.crit?'#ffd36a':'#26e2ff';ctx.shadowBlur=12;ctx.shadowColor=ctx.fillStyle;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill()}ctx.shadowBlur=0;
    for(const e of run.enemies){ctx.fillStyle=e.boss?'#8d5cff':e.elite?'#ff3aa7':'#d44c68';ctx.beginPath();ctx.arc(e.x,e.y,e.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(e.x-e.r,e.y-e.r-8,e.r*2,3);ctx.fillStyle=e.boss?'#b896ff':'#ff7188';ctx.fillRect(e.x-e.r,e.y-e.r-8,e.r*2*(e.hp/e.maxHp),3)}
    ctx.save();ctx.translate(run.px,run.py);ctx.fillStyle=run.invuln>0?'#fff':'#26e2ff';ctx.shadowBlur=22;ctx.shadowColor='#26e2ff';ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.fill();ctx.fillStyle='#0a0d16';ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();ctx.restore();ctx.shadowBlur=0;
    for(const p of run.particles){ctx.globalAlpha=Math.max(0,p.life*3);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,3)}ctx.globalAlpha=1;
    if(pointer.active){const dx=pointer.x-pointer.sx,dy=pointer.y-pointer.sy,mag=Math.min(42,Math.hypot(dx,dy)),a=Math.atan2(dy,dx);ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(pointer.sx,pointer.sy,44,0,Math.PI*2);ctx.stroke();ctx.fillStyle='rgba(141,92,255,.45)';ctx.beginPath();ctx.arc(pointer.sx+Math.cos(a)*mag,pointer.sy+Math.sin(a)*mag,18,0,Math.PI*2);ctx.fill()}
  }
  function endRun(survived,aborted=false){if(!run?.active)return;run.active=false;cancelAnimationFrame(raf);const time=run.t,kills=run.kills;let flux=Math.floor((kills*4+time*3)*(1+save.fractures*.12));let shards=0;if(run.bossDead)shards+=2+Math.floor(save.fractures/3);if(survived)shards+=1; if(aborted){flux=Math.floor(flux*.35);shards=0}save.flux+=flux;save.shards+=shards;save.bestTime=Math.max(save.bestTime,time);persist();$('#resultEyebrow').textContent=aborted?'RIFT ABORTED':survived?'RUN COMPLETE':'CORE COLLAPSED';$('#resultTitle').textContent=aborted?'Extraction forced':survived?'Rift survived':'You were consumed';$('#resultTime').textContent=`${Math.floor(time)}s`;$('#resultKills').textContent=kills;$('#resultFlux').textContent=`+${fmt(flux)}`;$('#resultShards').textContent=`+${fmt(shards)}`;$('#choiceModal').classList.add('hidden');$('#resultModal').classList.remove('hidden');tone(survived?760:110,.18)}
  $('#resultBackBtn').onclick=()=>{$('#resultModal').classList.add('hidden');$('#runScreen').classList.remove('active');$('#hub').classList.add('active');run=null;renderHub()};

  $('#soundBtn').textContent=save.sound?'🔊':'🔈'; renderHub();
})();
