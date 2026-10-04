// Loads the game's <script> into a VM with stub DOM/canvas, then tests mechanics and difficulty.
// Usage: node tests/game.test.js [game.html] [baseline.html]
//   baseline: optional older build to compare bot survival against, e.g.
//   git show <rev>:index.html > /tmp/old.html && node tests/game.test.js index.html /tmp/old.html
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
function load(file){
  const html=fs.readFileSync(file,'utf8'),src=html.match(/<script>([\s\S]*)<\/script>/)[1];
  const el=()=>({textContent:'',hidden:false,classList:{add(){},remove(){}},addEventListener(){},showModal(){},close(){},setPointerCapture(){},hasPointerCapture(){return false},releasePointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:420,height:760})});
  const ctxCalls={n:0},ctx=new Proxy({},{get:(t,k)=>k in t?t[k]:()=>{ctxCalls.n++},set:(t,k,v)=>(t[k]=v,true)});
  const els={};const canvasEl=el();canvasEl.getContext=()=>ctx;
  const sandbox={document:{querySelector:s=>s==='#game'?canvasEl:(els[s]??=el()),addEventListener(){},hidden:false},localStorage:{getItem:()=>null,setItem(){}},addEventListener(){},requestAnimationFrame(){},Math:Object.create(Math),console};
  vm.createContext(sandbox);vm.runInContext(src,sandbox);
  const run=code=>vm.runInContext(code,sandbox);
  return {run,sandbox,ctxCalls,els};
}
const NEW=process.argv[2]||path.join(__dirname,'..','index.html'),OLD=process.argv[3];
let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('  ✓',m)};

// ---------- unit checks on new build ----------
console.log('Mechanics');
const G=load(NEW),r=G.run;
const plans=r('[1,2,3,4,5,6,7,8].map(n=>hordePlan(n))');
const totals=plans.map((p,i)=>{let t=0;for(let s=0;s<p.surges;s++)t+=p.pack+(i+1>2?s:0);return t});
console.log('    crabs/round',totals.join(' '),'· gaps',plans.map(p=>p.interval.toFixed(1)).join(' '));
ok(totals.every((t,i)=>!i||t>totals[i-1]),'total crabs rise every round');
ok(plans.every((p,i)=>!i||p.interval<=plans[i-1].interval),'surge gaps shrink every round');
ok(totals[0]<=39,'round 1 is no bigger than before (≤39 crabs)');
ok(plans[0].shell===0&&plans[0].jumpy===0&&plans[0].kings===0&&plans[1].shell===0&&plans[1].kings===0,'rounds 1–2 have only plain, predictable crabs');
ok(plans[2].shell>0&&plans[3].jumpy>0&&plans[4].kings>0&&plans[7].kings===2,'shells from r3, jumpy from r4, kings from r5, two kings in r8');

// within-round escalation
r('round=3;begin();spawnHorde();globalThis.s1={n:crabs.length};crabs=[];spawnHorde();s1.n2=crabs.length');
ok(r('s1.n2>s1.n'),'later surges in a round are bigger');

// armour
const make=kind=>r(`round=5;begin();crabs=[];spawn(0,'${kind}');crabs[0].x=200;crabs[0].y=400;crabs[0].bx=200;crabs[0]`);
const hit=(type)=>r(`powerCooldown=0;perform({type:'${type}',x:200,y:400,radius:${type==='spin'||type==='power'?120:type==='snap'?43:0}||undefined,points:[{x:140,y:400},{x:260,y:400}]});crabs[0]`);
make('shell');let c=hit('sweep');ok(!c.away&&c.kind==='cracked'&&c.y<400&&c.stun>0,'sweep cracks a shell crab and knocks it back');
r('crabs[0].y=400;crabs[0].stun=0');c=hit('sweep');ok(c.away,'second sweep clears the cracked crab');
make('shell');ok(hit('whip').away,'whip clears a shell crab in one hit');
make('king');for(const t of ['snap','sweep','whip']){r('crabs[0].y=400;crabs[0].away=false');c=hit(t);ok(!c.away&&c.y>=150,`${t} only knocks a king crab back (stays on the beach)`)}
make('king');ok(hit('spin').away,'spin clears a king crab');
make('king');ok(hit('power').away,'power snap clears a king crab');
make('crab');ok(hit('snap').away,'a snap still clears a plain crab');
r('crabs=[];spawn(0,"king");crabs[0].x=200;crabs[0].y=160;crabs[0].bx=200');c=hit('sweep');
ok(c.y>=150,'knockback never pushes crabs off the beach into the sea');

// wet sand doubles speed
for(const [rd,wet] of [[1,false],[2,true],[4,false],[6,true],[8,false]]){
  const dy=r(`round=${rd};begin();surge=1;crabs=[];spawn(0,'crab');Object.assign(crabs[0],{y:340,jumpy:false,speed:40});update(.1);crabs[0].y-340`);
  ok(Math.abs(dy-(wet?8:4))<.01,`round ${rd}: crab on wet band moves ${wet?'2×':'1×'} (${dy.toFixed(2)})`);
}
// unpredictability: jumpy crab paths differ between runs from identical start
const jumpyPath=()=>r(`round=8;begin();surge=1;crabs=[];spawn(0,'crab');Object.assign(crabs[0],{jumpy:true,x:200,bx:200,startX:200,y:200,speed:40,phase:0});for(let i=0;i<60;i++)update(1/30);[crabs[0].x,crabs[0].y]`);
const runs=[...Array(6)].map(jumpyPath);ok(new Set(runs.map(p=>p.map(v=>v.toFixed(1)).join())).size>1,'jumpy crabs take different paths each time');
const calm=()=>r(`round=1;begin();surge=1;crabs=[];spawn(0,'crab');Object.assign(crabs[0],{x:200,bx:200,startX:200,y:200,speed:40,phase:0});for(let i=0;i<60;i++)update(1/30);crabs[0].x.toFixed(2)`);
ok(calm()===calm(),'round-1 crabs stay predictable');

// rendering all crab kinds doesn't throw
r(`round=8;begin();crabs=[];['crab','shell','king'].forEach((k,i)=>spawn(i,k));crabs[1].kind='cracked';crabs[0].burstT=.2;crabs[0].burstK=2;crabs[2].stun=.3;crabs[2].hit=.1`);
r('draw()');ok(G.ctxCalls.n>0,'draw() renders plain, cracked, dashing and stunned king crabs');
ok(!/bullet|projectile|shoot\(/i.test(fs.readFileSync(NEW,'utf8')),'no shooting mechanics added');

// round progresses to the between-screen
r('round=1;health=3;begin();for(let i=0;i<4000&&state==="playing";i++){for(const c of crabs)c.away=true;update(1/30)}');
ok(r('state')==='between','a cleared round moves to the build screen');
ok(/Next up: Incoming tide/.test(G.els['#description'].textContent),'build screen previews the next round');

// ---------- difficulty curve via a bot ----------
// Every 0.6–0.85 s the bot aims at the lowest crab with up to ±25 units of error: spin on a king near the castle when
// charged, whip a shell crab, else a 120-wide sweep. The skilled bot also spins on dense packs. All randomness is seeded.
function playRound(file,rd,seed,skilled=false){
  const {run}=load(file);let s=seed;const rand=()=>(s=(s*16807)%2147483647)/2147483647;
  run(`Math.random=()=>(globalThis.__s=(globalThis.__s*16807)%2147483647)/2147483647`);run(`globalThis.__s=${seed+1}`);
  run(`round=${rd};health=3;castle=${rd};begin()`);
  const hasPower=run('typeof trickPower!=="undefined"');
  let t=0,next=0;
  while(run('state')==='playing'&&t<240){
    run('update(1/30)');t+=1/30;
    if(t>=next){next=t+.6+rand()*.25;const ex=(rand()-.5)*50,ey=(rand()-.5)*40;
      run(`(()=>{const live=crabs.filter(c=>!c.away&&!c.dead&&c.y>150);if(!live.length)return;live.sort((a,b)=>b.y-a.y);const lo={...live[0],x:live[0].x+${ex},y:live[0].y+${ey}};
        const king=${hasPower}&&live.find(c=>c.kind==='king'&&c.y>380);const pack=${skilled}&&live[0].y>330&&live.filter(c=>Math.hypot(c.x-lo.x,c.y-lo.y)<110).length>=5;if(pack&&!king&&powerCooldown<=0){perform({type:'spin',x:lo.x,y:lo.y,radius:125,points:[{x:lo.x,y:lo.y}]});return}
        if(king&&powerCooldown<=0){perform({type:'spin',x:king.x,y:king.y,radius:125,points:[{x:king.x,y:king.y}]});return}
        const tough=${hasPower}&&(lo.armor||1)===2;
        if(tough){perform({type:'whip',x:lo.x+40,y:lo.y,points:[{x:lo.x-40,y:lo.y},{x:lo.x+40,y:lo.y}]});return}
        perform({type:'sweep',x:lo.x+80,y:lo.y,points:[{x:lo.x-60,y:lo.y},{x:lo.x+60,y:lo.y}]})})()`);
    }
  }
  return {won:run('state')!=='lost',lost:3-Math.max(0,run('health'))};
}
console.log('\nBot survival per round (30 seeded runs each)');
const N=30,rows=[];
for(let rd=1;rd<=8;rd++){
  const stats=(f,k)=>{const g=[...Array(N)].map((_,i)=>playRound(f,rd,1000+i*7919,k));return [g.filter(x=>x.won).length/N,g.reduce((a,x)=>a+x.lost,0)/N]};
  const o=OLD?stats(OLD):[null,null],n=stats(NEW),k=stats(NEW,true);rows.push([rd,o[0],n[0],k[0]]);
  const f=([w,h])=>`${(w*100).toFixed(0).padStart(3)}% won, ${h.toFixed(1)} hearts lost`;
  console.log(`    round ${rd}: ${OLD?'baseline '+f(o)+'  |  ':''}casual ${f(n)}  |  skilled ${f(k)}`);
}
ok(rows[0][2]>=.9,'round 1 stays approachable for the casual bot (≥90%)');
ok(rows[7][3]>0&&rows[7][3]<.9,'a skilled player can clear round 8, but not every time');ok(rows[7][2]<rows[0][2],'round 8 is clearly harder than round 1');
if(OLD)ok(rows.slice(4).reduce((a,r)=>a+r[2],0)<rows.slice(4).reduce((a,r)=>a+r[1],0),'rounds 5–8 are harder than the baseline');
console.log(`\n${pass} checks passed`);
