// Loads the game's <script> into a VM with stub DOM/canvas, then tests mechanics and difficulty.
// Usage: node tests/game.test.js [game.html] [baseline.html]
//   baseline: optional older build to compare bot survival against, e.g.
//   git show <rev>:index.html > /tmp/old.html && node tests/game.test.js index.html /tmp/old.html
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
function load(file,store={}){
  const html=fs.readFileSync(file,'utf8'),src=html.match(/<script>([\s\S]*)<\/script>/)[1];
  const el=()=>({textContent:'',hidden:false,classList:{add(){},remove(){}},addEventListener(){},setAttribute(){},showModal(){},close(){},setPointerCapture(){},hasPointerCapture(){return false},releasePointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:420,height:760})});
  const ctxCalls={n:0},ctx=new Proxy({},{get:(t,k)=>k in t?t[k]:()=>{ctxCalls.n++;return {addColorStop(){}}},set:(t,k,v)=>(t[k]=v,true)});
  const els={};const canvasEl=el();canvasEl.getContext=()=>ctx;
  const sandbox={document:{querySelector:s=>s==='#game'?canvasEl:(els[s]??=el()),addEventListener(){},hidden:false},localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)}},addEventListener(){},requestAnimationFrame(){},Math:Object.create(Math),console};
  vm.createContext(sandbox);vm.runInContext(src,sandbox);
  const run=code=>vm.runInContext(code,sandbox);
  return {run,sandbox,ctxCalls,els,store};
}
const NEW=process.argv[2]||path.join(__dirname,'..','index.html'),OLD=process.argv[3];
let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('  ✓',m)};

// ---------- unit checks on new build ----------
console.log('Mechanics');
const G=load(NEW),r=G.run;
const plans=r('[1,2,3,4,5,6,7,8].map(n=>hordePlan(n))');
const totals=r("[1,2,3,4,5,6,7,8].map(n=>roundTotal(n))");
console.log('    crabs/round',totals.join(' '),'· gaps',plans.map(p=>p.interval.toFixed(1)).join(' '));
const horde=plans.map((p,i)=>[p,totals[i]]).filter(([p])=>!p.pop);
ok(horde.every(([,t],i)=>!i||t>horde[i-1][1]),'total crabs rise every horde round');
ok(horde.every(([p],i)=>!i||p.interval<=horde[i-1][0].interval),'surge gaps shrink every horde round');
ok(totals[0]<=39,'round 1 is no bigger than before (≤39 crabs)');
ok(plans[0].shell===0&&plans[0].jumpy===0&&plans[0].kings===0&&plans[1].shell===0&&plans[1].kings===0,'rounds 1–2 have only plain, predictable crabs');
ok(plans[2].shell>0&&plans[3].jumpy>0&&plans[4].kings>0&&plans[7].kings===2,'shells from r3, jumpy from r4, kings from r5, two kings in r8');

// within-round escalation
r('round=3;begin();spawnHorde();globalThis.s1={n:crabs.length};crabs=[];spawnHorde();s1.n2=crabs.length');
ok(r('s1.n2>s1.n'),'later surges in a round are bigger');

// armour
const make=kind=>r(`round=5;begin();crabs=[];spawn(0,'${kind}');crabs[0].x=200;crabs[0].y=400;crabs[0].bx=200;crabs[0]`);
const hit=(type)=>r(`powerCooldown=0;chain=0;lastTrick='';golden=0;perform({type:'${type}',x:200,y:400,radius:${type==='spin'||type==='power'?120:type==='snap'?43:0}||undefined,points:[{x:140,y:400},{x:260,y:400}]});crabs[0]`);
make('shell');let c=hit('sweep');ok(!c.away&&c.kind==='cracked'&&c.y<400&&c.stun>0,'sweep cracks a shell crab and knocks it back');
r('crabs[0].y=400;crabs[0].stun=0');c=hit('sweep');ok(c.away,'second sweep clears the cracked crab');
make('shell');ok(hit('whip').away,'whip clears a shell crab in one hit');
make('king');for(const t of ['snap','sweep','whip']){r('crabs[0].y=400;crabs[0].away=false');c=hit(t);ok(!c.away&&c.y>=150,`${t} only knocks a king crab back (stays on the beach)`)}
make('king');ok(hit('spin').away,'spin clears a king crab');
make('king');ok(hit('power').away,'power snap clears a king crab');
make('crab');ok(hit('snap').away,'a snap still clears a plain crab');
r('crabs=[];spawn(0,"king");crabs[0].x=200;crabs[0].y=160;crabs[0].bx=200;player.y=260');c=hit('sweep');
ok(c.y>=150,'knockback never pushes crabs off the beach into the sea');

// wet sand doubles speed
for(const [rd,wet] of [[1,false],[2,true],[4,false],[7,false],[8,false]]){
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

// golf-style swing gesture, using real touch paths through the classifier
console.log('Swing & release');
const line=(pts,ms=12)=>JSON.stringify(pts.map(([x,y],i)=>({x,y,t:i*ms})));
const stroke=(from,to,n=8)=>[...Array(n+1)].map((_,i)=>[from[0]+(to[0]-from[0])*i/n,from[1]+(to[1]-from[1])*i/n]);
const swing=(back,fwd)=>[...stroke([200,500],[200,500+back]),...stroke([200,500+back],[200,500+back-fwd]).slice(1)];
let k=r(`classify(${line(swing(80,200))})`);ok(k.type==='whip'&&!k.perfect,'drag back 80 then swing forward → whip');
const shortReach=k.reach;k=r(`classify(${line(swing(170,260))})`);ok(k.type==='whip'&&k.perfect&&k.reach>shortReach,'a full backswing is a Perfect swing with longer reach');
ok(r(`classify(${line(stroke([60,400],[360,400]),6)}).type`)==='sweep','a fast straight flick is now a plain sweep');
ok(r(`classify(${line(swing(25,200))}).type`)==='sweep','a tiny backswing does not count as a swing');
ok(r(`classify(${line([...Array(25)].map((_,i)=>[200+70*Math.cos(i/24*2*Math.PI),400+70*Math.sin(i/24*2*Math.PI)]))}).type`)==='spin','circles still spin');
ok(r(`classify(${line([[200,400],[203,401],[201,399]],400)}).type`)==='power','hold and release still power-snaps');
r("round=3;begin();crabs=[];spawn(0,'shell');Object.assign(crabs[0],{x:200,y:330,bx:200})");
r(`perform(classify(${line(swing(170,120))}))`);ok(r('crabs[0].away')&&/Perfect swing/.test(r('feedback')),'swinging up through the beach clears a shell crab beyond your finger');
r("round=1;begin();gesture={id:1,points:"+line(stroke([200,500],[200,620]))+",began:0};draw()");ok(true,'live backswing meter draws without errors');
r('personPose()');ok(r('pose')==='windup'&&r('handPos().y')<r('player.y')-30,'the cowboy raises the towel overhead during the backswing');
r("gesture=null;swats=[{type:'whip',x:300,y:300,points:[{x:200,y:500},{x:300,y:300}],life:.45,maxLife:.45}];personPose()");ok(r('pose')==='crack'&&r('handPos().x')>r('player.x')+25,'he snaps the towel arm forward when a trick lands');
r('draw()');r("swats=[];personPose()");ok(r('pose')==='idle','and returns to idle with the towel hanging');r('draw()');

// the cowboy stands guard in front of the castle and turns toward the crab nearest it
console.log('Cowboy');
ok(r('typeof movePlayer')==='undefined'&&r('player.x')===210,'he stays put in front of the castle');
r('round=1;begin();crabs=[];spawn(0,"crab");Object.assign(crabs[0],{x:390,y:420,bx:390,startX:390,speed:0});for(let i=0;i<30;i++)update(1/30)');ok(r('look')>.6,'he turns toward a crab coming down the right');
r('crabs[0].x=crabs[0].bx=crabs[0].startX=30;for(let i=0;i<30;i++)update(1/30)');ok(r('look')<-.6,'and toward one on the left');
r('crabs=[];for(let i=0;i<60;i++)update(1/30)');ok(Math.abs(r('look'))<.05,'with no crabs about he faces straight up the beach');r('draw()');
r('round=1;begin();crabs=[];spawn(0,"crab");Object.assign(crabs[0],{x:210,y:250,bx:210,startX:210})');c=r('perform({type:"sweep",x:270,y:250,points:[{x:150,y:250},{x:270,y:250}]});crabs[0]');ok(!c.away&&/Out of reach/.test(r('feedback')),'the towel cannot reach crabs far up the beach, and says so');
c=r('crabs[0].y=400;perform({type:"sweep",x:270,y:400,points:[{x:150,y:400},{x:270,y:400}]});crabs[0]');ok(c.away,'once they come closer they are within reach');
r('begin();crabs=[];spawn(0,"crab");Object.assign(crabs[0],{x:210,y:250,bx:210,startX:210})');ok(r('perform(classify('+line(swing(170,200))+'));crabs[0].away'),'a full whip reaches crabs that a sweep cannot');

// prizes: one per cleared round, placed before the round starts; they stay put from round to round
console.log('Prizes');
r('round=1;health=3;begin();surge=hordePlan().surges;crabs=[];update(.01)');ok(/You won a pair of jandals/.test(G.els['#description'].textContent),'clearing round 1 wins a pair of jandals');
ok(r("prizes.map(p=>p.name).join()")==='Jandals,Sun lounger,Chilly bin,Beach umbrella,Boogie board,Windbreak,Picnic hamper','then a sun lounger, a chilly bin and more, one per round');
r("$('#action').onclick()");ok(r('state')==='setup'&&r('round')===2&&G.els['#go'].hidden===false&&G.els['#trayL'].hidden===false,'the next round opens with a setup step to place prizes');
r('for(let i=0;i<120;i++)update(1/30)');ok(r('crabs.length')===0,'no crabs arrive until the round is started');
ok(!r('placePrize(0,210,640)')&&!r('placePrize(0,210,120)'),'prizes can only go on the open sand, not the castle or the sea');
ok(r('placePrize(0,150,420)')&&r('items.length')===1&&/disabled/.test(G.els['#trayL'].innerHTML),'a prize dropped on the sand leaves the tray');
r('startRound()');ok(r('state')==='playing'&&G.els['#go'].hidden===true&&G.els['#trayL'].hidden===true,'Start round sets the crabs going and tucks the tray away');
ok(!r('placePrize(0,250,420)'),'prizes cannot be moved mid-round');
r('round=4;castle=4;begin(true)');ok(r('owned().length')===3&&(G.els['#trayL'].innerHTML.match(/data-p=/g)||[]).length===3,'by round 4 the tray beside the castle holds three prizes');
ok(r('items.length')===1&&r('items[0].x')===150&&r('items[0].y')===420,'the jandals are still where they were placed');
ok(r('grabPrize({x:152,y:418},7)')&&r('items.length')===0,'pressing a placed prize picks it up');
r('dropPrize({pointerId:7,clientX:300,clientY:380,timeStamp:0})');ok(r('layout[0].x')===298&&r('layout[0].y')===382&&r('items[0].x')===298,'and dropping it moves it to the new spot');
r('placePrize(1,210,400)');r('grabPrize({x:210,y:400},8)');r('dropPrize({pointerId:8,clientX:210,clientY:700,timeStamp:0})');ok(!('1' in r('layout'))&&!/data-p="1" disabled/.test(G.els['#trayL'].innerHTML),'dragging a prize off the sand puts it back in the tray');
r('placePrize(1,210,400);startRound()');
r('crabs=[];spawn(0,"crab");Object.assign(crabs[0],{x:210,y:360,bx:210,startX:210,speed:60,jumpy:false});for(let i=0;i<20;i++)update(1/30)');const held=r('crabs[0].y');
ok(held<400-17+3&&r('crabs[0].block')>0,`a crab walking into the sun lounger is held up (stopped at y ${held.toFixed(0)})`);
r('for(let i=0;i<45;i++)update(1/30)');ok(r('crabs[0].y')>held+10,'then climbs over and carries on');
r('items.find(o=>o.i===1).left=1;crabs=[];spawn(0,"crab");Object.assign(crabs[0],{x:210,y:360,bx:210,startX:210,speed:60,jumpy:false});for(let i=0;i<20;i++)update(1/30)');ok(!r('items.some(o=>o.i===1)'),'a prize is knocked over after holding up its quota of crabs');
r('begin(true)');ok(r('items.length')===2&&r('items.every(o=>o.left===o.uses)'),'knocked-over prizes are back, fresh and in place, for the next attempt');
r("$('#alt').onclick()");ok(r('round')===1&&r('Object.keys(layout).length')===0&&r('state')==='playing','Start over clears the beach');

// golden towel: three different tricks in a row power it up for a few seconds
console.log('Golden towel');
r("round=3;begin();crabs=[];['sweep','snap','whip'].forEach(t=>{spawn(0,'crab');Object.assign(crabs.at(-1),{x:200,y:420});clock+=.5;perform({type:t,x:200,y:420,radius:t==='snap'?43:undefined,points:[{x:140,y:420},{x:260,y:420}]})})");
ok(r('golden')>3&&/golden towel/.test(r('feedback')),'a ×3 combo turns the towel golden for a few seconds');
r("crabs=[];spawn(0,'crab');Object.assign(crabs[0],{x:210,y:290,bx:210})");ok(r("perform({type:'sweep',x:270,y:290,points:[{x:150,y:290},{x:270,y:290}]});crabs[0].away"),'a golden towel reaches farther');
r("crabs=[];spawn(0,'shell');Object.assign(crabs[0],{x:210,y:420,bx:210})");ok(r("perform({type:'sweep',x:270,y:420,points:[{x:150,y:420},{x:270,y:420}]});crabs[0].away"),'and its sweeps clear shell crabs in one hit');
r('draw();for(let i=0;i<200;i++)update(1/30)');ok(r('golden')===0,'the power wears off after a few seconds');
const combo3=()=>r("chain=0;lastTrick='';['sweep','snap','whip'].forEach(t=>{crabs=[];spawn(0,'crab');Object.assign(crabs[0],{x:200,y:420});clock+=.5;perform({type:t,x:200,y:420,radius:t==='snap'?43:undefined,points:[{x:140,y:420},{x:260,y:420}]})});golden");
ok(combo3()===0,'another ×3 combo straight after does not power it up again');r('crabs=[];spawnClock=99;for(let i=0;i<300;i++)update(1/30)');ok(r('state')==='playing'&&combo3()>3,'but one ten seconds later does');

// pop-up round: crabs burrow up within reach; only taps catch them
console.log('Pop-up crabs');
ok(r('hordePlan(POP).pop')&&r('rounds[POP-1]')==='Pop-up crabs'&&!r('wetRound(POP)'),'round 6 is the pop-up round');
r('round=POP;begin();for(let i=0;i<150;i++)update(1/30)');const pops=r('crabs.filter(c=>c.popper&&c.pop<c.up).map(c=>[c.x,c.y])');
ok(pops.length>=2&&pops.every(([x,y])=>y>=200&&y<=400&&x>=40&&x<=380),`crabs pop up one at a time on the far half of the beach (${pops.length} up)`);
r('crabs=[];spawnPop();Object.assign(crabs[0],{x:60,y:210,pop:0})');ok(r('perform({type:"snap",x:62,y:205,radius:43,points:[{x:62,y:205}]});crabs[0].away'),'a tap catches a pop-up even beyond the towel reach');
r('crabs=[];spawnPop();crabs[0].pop=0');const pc=r('crabs[0]');
r(`perform({type:'sweep',x:${pc.x+60},y:${pc.y},points:[{x:${pc.x-60},y:${pc.y}},{x:${pc.x+60},y:${pc.y}}]})`);ok(!r('crabs[0].away')&&/duck/.test(r('feedback')),'a pop-up crab ducks under a sweep');
r(`perform({type:'snap',x:${pc.x+10},y:${pc.y-8},radius:43,points:[{x:${pc.x+10},y:${pc.y-8}}]})`);ok(r('crabs[0].away'),'but an accurate tap catches it');
r('crabs=[];spawnPop();globalThis.c0=crabs[0];c0.y0=c0.y;for(let i=0;i<20;i++)update(1/30);globalThis.still=c0.y===c0.y0;for(let i=0;i<70;i++)update(1/30)');ok(r('still')&&r('c0.y>c0.y0+20'),'one left up too long runs for the castle');
r('draw()');

// towels: each trades reach, swipe width, recharge and hitting power
console.log('Towels');
ok(r('towels.length')>=4&&r('towel===towels[0]'),'several towels to choose from, the all-rounder by default');
const far=n=>r(`towel=towels[${n}];round=1;begin();crabs=[];spawn(0,"crab");Object.assign(crabs[0],{x:210,y:290,bx:210,startX:210});perform({type:"sweep",x:270,y:290,points:[{x:150,y:290},{x:270,y:290}]});crabs[0].away`);
ok(far(1)&&!far(0),'the pool towel reaches crabs the beach towel cannot');
const wide=n=>r(`towel=towels[${n}];round=1;begin();crabs=[];spawn(0,"crab");Object.assign(crabs[0],{x:210,y:400+52,bx:210,startX:210});perform({type:"sweep",x:270,y:400,points:[{x:150,y:400},{x:270,y:400}]});crabs[0].away`);
ok(wide(2)&&!wide(0),'the bath sheet sweeps a wider strip');
ok(r('towel=towels[2];powerCooldown=0;perform({type:"spin",x:210,y:400,radius:125,points:[{x:210,y:400}]});powerCooldown')>2.5,'but its spin takes longer to recharge');
const shellHit=n=>r(`towel=towels[${n}];round=3;begin();crabs=[];spawn(0,"shell");Object.assign(crabs[0],{x:210,y:420,bx:210});perform({type:"sweep",x:270,y:420,points:[{x:150,y:420},{x:270,y:420}]});crabs[0].away`);
ok(shellHit(3)&&!shellHit(0),'a wet towel sweep clears a shell crab in one hit');
ok(!r('towel=towels[3];round=5;begin();crabs=[];spawn(0,"king");Object.assign(crabs[0],{x:210,y:420,bx:210});perform({type:"whip",x:270,y:420,points:[{x:150,y:420},{x:270,y:420}]});crabs[0].away'),'kings still need a spin or power snap, even with a wet towel');
r('towel=towels[0]');
const T=load(NEW,{crabAttackTowel:'2'});ok(T.run('towel.name')==='Bath sheet'&&/aria-checked="true" data-i="2"/.test(T.els['#towels'].innerHTML),'the chosen towel is remembered and shown as selected');
T.run('state="paused";show("Beach break","","Keep playing")');ok(T.els['#picker'].hidden===true,'towels cannot be swapped mid-round from the pause screen');

// retry, near-miss, stars, hit-pause, sound
console.log('Replay features');
const R=load(NEW),q=R.run;
q('round=4;score=500;health=3;begin();spawnHorde();score=640;health=1;crabs[0].y=700;update(.01)');
ok(q('state')==='lost','losing the last heart ends the round');
const lost=R.els['#description'].textContent;ok(/crabs? left in Crab parade/.test(lost),`loss screen says how close you got ("${lost.split('\n')[0]}")`);
ok(R.els['#action'].textContent==='Retry round 4'&&R.els['#alt'].hidden===false,'loss offers Retry round 4 plus Start over');
q("$('#action').onclick()");ok(q('state==="setup"&&round===4&&score===500&&health===3'),'retry replays the same round from its starting score, after a chance to rearrange prizes');
q("$('#alt').onclick()");ok(q('round===1&&score===0'),'Start over returns to round 1');
const clearWith=(hp,combo)=>{q(`health=3;begin();health=${hp};bestChain=${combo};surge=hordePlan().surges;crabs=[];update(.01)`);return R.els['#icon'].textContent};
q('round=2;castle=2');ok(clearWith(2,1)==='★☆☆','clearing with a heart lost and no big combo earns 1 star');
q('round=2');ok(clearWith(3,1)==='★★☆','no hearts lost earns a second star');
q('round=2');ok(clearWith(3,4)==='★★★','a ×4 combo earns the third star');
q('round=2');clearWith(2,1);ok(JSON.parse(R.store.crabAttackStars)[1]===3,'best stars per round are kept, not overwritten by a worse run');
ok(/3 \/ 24 ★|\d+ \/ 24 ★/.test(R.els['#note'].textContent),'build screen shows the star total');
q("round=3;begin();crabs=[];['sweep','snap','sweep','snap'].forEach((t,i)=>{spawn(0,'crab');Object.assign(crabs.at(-1),{x:200,y:400});clock+=.5;perform({type:t,x:200,y:400,radius:t==='snap'?43:undefined,points:[{x:140,y:400},{x:260,y:400}]})})");
ok(q('bestChain')===4&&/combo star/.test(q('feedback')),'alternating tricks reach a ×4 combo and announce the star');
q("round=5;begin();crabs=[];spawn(0,'king');Object.assign(crabs[0],{x:200,y:400});powerCooldown=0;perform({type:'spin',x:200,y:400,radius:125,points:[{x:200,y:400}]})");
ok(q('freeze>0&&shake>0'),'clearing a king triggers hit-pause and screen shake');
q("begin();crabs=[];spawn(0,'crab');Object.assign(crabs[0],{x:200,y:400});perform({type:'snap',x:200,y:400,radius:43,points:[{x:200,y:400}]})");
ok(q('freeze===0'),'a single small hit does not pause the game');
ok(q("sfx('king');sfx('lose');true"),'sound calls are safe without audio support');
q("$('#sound').onclick()");ok(R.store.crabAttackMuted==='1'&&R.els['#sound'].textContent==='🔇','mute toggles and is remembered');
const R2=load(NEW,{crabAttackMuted:'1',crabAttackStars:'[3,2]'});ok(R2.run('muted')&&/5 \/ 24 ★/.test(R2.els['#note'].textContent),'saved mute setting and star total load on start');

// installable web app: manifest, icons and offline cache all line up
console.log('Web app');
{const root=path.join(__dirname,'..'),man=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8')),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),page=fs.readFileSync(NEW,'utf8');
ok(man.icons.some(i=>i.sizes==='192x192')&&man.icons.some(i=>i.sizes==='512x512'&&i.purpose==='maskable')&&man.icons.every(i=>fs.existsSync(path.join(root,i.src))),'the manifest lists 192 and 512 px icons (one maskable) that exist');
const cached=JSON.parse(sw.match(/FILES = (\[.*?\]);/)[1].replace(/'/g,'"'));ok(cached.filter(f=>f!=='./').every(f=>fs.existsSync(path.join(root,f)))&&man.icons.every(i=>cached.includes(i.src)),'the service worker caches the page, manifest and every icon');
ok(/rel="manifest" href="manifest.webmanifest"/.test(page)&&/serviceWorker\.register\('sw\.js'\)/.test(page),'the page links the manifest and registers the service worker');}

// ---------- difficulty curve via a bot ----------
// The bot places its prizes in a band across the beach before starting the round. Every 0.6–0.85 s (0.4–0.55 s when tapping pop-ups) it aims at the lowest crab with up to ±25 units of error: spin on a king near the castle when
// charged, tap a pop-up crab, whip a shell crab, else a 120-wide sweep. The skilled bot also spins on dense packs. All randomness is seeded.
function playRound(file,rd,seed,skilled=false){
  const {run}=load(file);let s=seed;const rand=()=>(s=(s*16807)%2147483647)/2147483647;
  run(`Math.random=()=>(globalThis.__s=(globalThis.__s*16807)%2147483647)/2147483647`);run(`globalThis.__s=${seed+1}`);
  run(`round=${rd};health=3;castle=${rd};begin(true)`);
  const hasPower=run('typeof trickPower!=="undefined"');
  if(run('typeof startRound')==='function')run('owned().forEach((p,i)=>placePrize(i,...[[110,430],[310,430],[210,395],[60,480],[360,480],[210,470],[140,370]][i]));startRound()');
  const popRound=run('typeof hordePlan==="function"&&!!hordePlan().pop');let t=0,next=0;
  while(run('state')==='playing'&&t<240){
    run('update(1/30)');t+=1/30;
    if(t>=next){next=t+(popRound?.4+rand()*.15:.6+rand()*.25);const ex=(rand()-.5)*50,ey=(rand()-.5)*40;
      run(`(()=>{const live=crabs.filter(c=>!c.away&&!c.dead&&c.y>150&&!(c.popper&&c.pop<0));if(!live.length)return;live.sort((a,b)=>b.y-a.y);const lo={...live[0],x:live[0].x+${ex},y:live[0].y+${ey}};
        const king=${hasPower}&&live.find(c=>c.kind==='king'&&c.y>380);const pack=${skilled}&&live[0].y>330&&live.filter(c=>Math.hypot(c.x-lo.x,c.y-lo.y)<110).length>=5;if(pack&&!king&&powerCooldown<=0){perform({type:'spin',x:lo.x,y:lo.y,radius:125,points:[{x:lo.x,y:lo.y}]});return}
        if(king&&powerCooldown<=0){perform({type:'spin',x:king.x,y:king.y,radius:125,points:[{x:king.x,y:king.y}]});return}
        const tough=${hasPower}&&(lo.armor||1)===2;
        if(lo.popper){perform({type:'snap',x:lo.x,y:lo.y,radius:43,points:[{x:lo.x,y:lo.y}]});return}
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
