import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync('public/hostinger-portal.js','utf8');
async function run(role){
 const writes=[],elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{value:id==='login-email'?'student@example.com':'long-password',style:{},classList:{add(){},remove(){}},setAttribute(){}});return elements.get(id);};
 let logged=false;
 const context={console,CU:null,SYNC_CONFIG:{},CF_WORKER_URL:'',document:{createElement:()=>element('status'),body:{appendChild(){}},getElementById:element},sessionStorage:{removeItem(){}},localStorage:{removeItem(){}},location:{reload(){}},showPortal(){},setTimeout:(fn,delay)=>{if(delay===300)return 1;return setTimeout(fn,delay===2000?0:delay);},clearTimeout(){},alert(){},addEventListener(){}};
 context.fetch=async(url,options)=>{
  const route=new URL(url,'https://example.com').searchParams.get('route');
  if(route==='me'&&!logged)return {ok:false,status:401,json:async()=>({error:'login'})};
  if(route==='login'){logged=true;return{ok:true,json:async()=>({csrf:'test',user:{email:'student@example.com',name:'Student',role}})};}
  if(route==='state'&&options.method==='GET')return{ok:true,json:async()=>({revision:0,state:{users:{'student@example.com':{name:'Student',role}},progress:{'student@example.com':{modulos:[]}},programs:[]}})};
  if(route==='state'){writes.push(JSON.parse(options.body));return{ok:true,json:async()=>({revision:writes.length})};}
  throw Error('Unexpected endpoint '+route);
 };
 context.window=context;vm.createContext(context);vm.runInContext(source,context);
 await new Promise(r=>setImmediate(r));await context.doLogin();
 const db=context.getDB();db.progress['student@example.com']={modulos:['m1']};db.progress['other@example.com']={modulos:['m2']};db.access={'student@example.com':{modulos:['restricted']}};db.users['student@example.com'].role='admin';db.programs=[{id:'fake'}];context.saveDB(db);
 await new Promise(resolve=>{context.syncUserToCloud('',{},()=>resolve());});
 assert.equal(writes.length,1);assert.equal(writes[0].revision,0);
 if(role==='vendedor'){assert.equal(writes[0].changes.length,1);assert.equal(writes[0].changes[0].owner,'student@example.com');assert.equal(writes[0].changes[0].key,'progress');}
 else assert.ok(writes[0].changes.some(c=>c.key==='access'));
 return context;
}
const student=await run('vendedor');await assert.rejects(student.fetch('/api/users',{method:'POST'}),/deshabilitado/);await run('admin');
console.log('PASS: student saves own progress; admin saves access; legacy endpoints blocked.');
