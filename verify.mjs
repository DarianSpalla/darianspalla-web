import assert from 'node:assert/strict';
import worker from './worker.js';
const data=new Map([['users',JSON.stringify({'student@example.com':{name:'Student',role:'vendedor',pass:'test-password'},'admin@example.com':{name:'Admin',role:'admin',pass:'old-exposed-password'}})],['access',JSON.stringify({'student@example.com':{modulos:[0]}})]]);
const env={DB:{get:async(k,o)=>{const v=data.get(k);return o?.type==='json'&&v?JSON.parse(v):v||null},put:async(k,v)=>data.set(k,v)},LOGIN_LIMITER:{limit:async()=>({success:true})},ADMIN_PASSWORD:'private-admin-test',ASSETS:{fetch:async()=>new Response('asset')}};
async function req(path,body,token,method){return worker.fetch(new Request('https://example.com/api'+path,{method:method|| (body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})}),env)}
assert.equal((await worker.fetch(new Request('https://example.com/'),env)).status,200);
assert.equal((await req('/sync')).status,401);
assert.equal((await req('/login',{email:'admin@example.com',pass:'old-exposed-password'})).status,401);
const login=await (await req('/login',{email:'student@example.com',pass:'test-password'})).json();assert(login.token);assert(!login.user.pass);assert(!JSON.parse(data.get('users'))['student@example.com'].pass);
assert.equal((await req('/access/admin%40example.com',null,login.token)).status,403);
assert.equal((await req('/sync',null,login.token)).status,403);
assert.equal((await req('/users',{email:'student@example.com',userData:{role:'admin'},accessData:{modulos:[1,2,3]}},login.token)).status,200);
assert.equal(JSON.parse(data.get('users'))['student@example.com'].role,'vendedor');assert.deepEqual(JSON.parse(data.get('access'))['student@example.com'].modulos,[0]);
assert.equal((await req('/certs',{name:'fake'},login.token)).status,403);
const admin=await (await req('/login',{email:'admin@example.com',pass:'private-admin-test'})).json();assert(admin.token);
const sync=await (await req('/sync',null,admin.token)).json();assert(!sync.users['student@example.com'].passwordHash);
assert.equal((await worker.fetch(new Request('https://example.com/api/sync',{headers:{Origin:'https://evil.example'}}),env)).status,403);
console.log('11 comprobaciones correctas: acceso, contraseñas, permisos, sincronización y origen.');
