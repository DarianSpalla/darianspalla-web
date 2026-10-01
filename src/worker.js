import { CONTENT } from './content.js';
const MAPS=['users','access','diags','progress','msgs_v2','replies','exams','frasesUser','badgesEarned','moduleNotes','modulePlan','lastSeenReplies'];
const OWN=['diags','msgs_v2','frasesUser','moduleNotes','modulePlan','lastSeenReplies'];
const GLOBALS=['programs','progModulos','videosDB','frasesDB','emailConfig'];
const TYPES={inmobiliario:['ALL_MODULOS','ALL_EXAMENES'],vida:['ALL_MODULOS_VIDA','ALL_EXAMENES_VIDA'],liderazgo:['ALL_MODULOS_LIDERAZGO','ALL_EXAMENES_LIDERAZGO']};
const encoder=new TextEncoder();
class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
const deny=(status,message)=>{throw new HttpError(status,message);};
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
const hex=buffer=>Array.from(new Uint8Array(buffer),x=>x.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
const same=(a,b)=>{if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;};
export async function passwordHash(password,salt=random()) {
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const hash=hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},key,256));
 return `pbkdf2:100000:${salt}:${hash}`;
}
async function passwordValid(password,stored){if(!stored?.startsWith('pbkdf2:100000:'))return false;return same(await passwordHash(password,stored.split(':')[2]),stored);}
function passwordCheck(password){if(typeof password!=='string'||password.length<10||password.length>128)deny(422,'Usá una contraseña de entre 10 y 128 caracteres.');}
function emailCheck(value){const email=String(value||'').trim().toLowerCase();if(/["'`]/.test(email)||email.length>190||!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(email))deny(422,'Email inválido.');return email;}
function text(value,max=1000){if(typeof value!=='string')deny(422,'Texto inválido.');const out=value.trim();if(out.length>max||/[<>]/.test(out))deny(422,'Usá texto simple, sin etiquetas HTML.');return out;}
function plain(value){if(typeof value==='string'&&(/[<>]/.test(value)||value.length>20000))deny(422,'Usá texto simple, sin etiquetas HTML.');if(Array.isArray(value))value.forEach(plain);else if(value&&typeof value==='object'){for(const [key,v]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key))deny(422,'Campo inválido.');plain(v);}}}
async function bodyOf(request){if(!request.headers.get('Content-Type')?.includes('application/json'))deny(415,'Se requiere JSON.');const reader=request.body?.getReader();if(!reader)return {};let total=0,parts=[];for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>1500000){await reader.cancel();deny(413,'Solicitud demasiado grande.');}parts.push(value);}const bytes=new Uint8Array(total);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}try{const body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=='object'||Array.isArray(body))deny(400,'Solicitud inválida.');return body;}catch(e){if(e instanceof HttpError)throw e;deny(400,'JSON inválido.');}}
const stmt=(db,sql,...params)=>db.prepare(sql).bind(...params);
async function record(db,kind,owner=''){const row=await stmt(db,'SELECT data FROM portal_records WHERE kind=? AND owner=?',kind,owner).first();return row?.data?JSON.parse(row.data):null;}
function write(db,kind,owner,value){return stmt(db,'INSERT INTO portal_records(kind,owner,data) VALUES(?,?,?) ON CONFLICT(kind,owner) DO UPDATE SET data=excluded.data,version=version+1',kind,owner,value===null?null:JSON.stringify(value));}
async function limit(db,key,max,seconds){const now=Math.floor(Date.now()/1000),bucket=await digest(key);const row=await stmt(db,'INSERT INTO portal_limits(bucket,attempts,started) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN started<? THEN 1 ELSE attempts+1 END,started=CASE WHEN started<? THEN excluded.started ELSE started END RETURNING attempts',bucket,now,now-seconds,now-seconds).first();if(row.attempts>max)deny(429,'Demasiados intentos. Esperá unos minutos.');}
async function auth(request,db){const token=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-ds_portal='))?.slice('__Host-ds_portal='.length);if(!token)deny(401,'Ingresá al portal.');const session=await stmt(db,'SELECT s.email,s.csrf,s.token_hash,a.role FROM portal_sessions s JOIN portal_accounts a ON a.email=s.email WHERE s.token_hash=? AND s.expires>? AND a.active=1',await digest(token),Math.floor(Date.now()/1000)).first();if(!session)deny(401,'Tu sesión venció. Ingresá de nuevo.');const profile=await record(db,'users',session.email);return {...session,profile:{...profile,email:session.email,role:session.role}};}
async function programs(db){return await record(db,'programs')||[];}
function enrollment(access,profile){return access?.programs?.length?access.programs:[profile?.prog].filter(Boolean);}
async function modules(db,prog){const custom=await record(db,'progModulos');return custom?.[prog.id]||CONTENT[TYPES[prog.type]?.[0]||'ALL_MODULOS'];}
async function accessInfo(db,user){return await record(db,'access',user.email)||{};}
function unlocked(access,prog,id){return (access.byProg?.[prog.id]?.modulos||access.modulos||[]).includes(id);}
async function allowedModule(db,user,id){const access=await accessInfo(db,user);for(const prog of await programs(db)){if(user.role==='admin'||(enrollment(access,user.profile).includes(prog.id)&&unlocked(access,prog,id))){const mod=(await modules(db,prog)).find(m=>m.id===id);if(mod)return {prog,mod};}}deny(403,'Este módulo no está habilitado para tu cuenta.');}
function resources(list,key,access,user){return (Array.isArray(list)?list:[]).filter(r=>user.role==='admin'||r.visible||(access[key]||[]).includes(r.id)).map(r=>({...r,visible:true}));}
async function snapshot(db,user){
 const rows=(await (user.role==='admin'?db.prepare('SELECT kind,owner,data,version FROM portal_records'):stmt(db,"SELECT kind,owner,data,version FROM portal_records WHERE owner=? OR owner=''",user.email)).all()).results;
 const state={},versions={};for(const key of MAPS)state[key]={};state.reflexiones=[];state.certs=[];
 for(const row of rows){const visible=user.role==='admin'||(!row.owner&&GLOBALS.includes(row.kind))||row.owner===user.email;if(!visible)continue;versions[row.kind+':'+row.owner]=row.version;if(!row.data)continue;const value=JSON.parse(row.data);if(MAPS.includes(row.kind))state[row.kind][row.owner]=value;else if(row.kind==='reflexiones'||row.kind==='certs')state[row.kind].push(...value);else if(GLOBALS.includes(row.kind))state[row.kind]=value;}
 if(user.role!=='admin'){state.programs=(state.programs||[]).map(({code,...p})=>p);delete state.emailConfig;const access=state.access[user.email]||{};state.videosDB=resources(state.videosDB||CONTENT.DEFAULT_VIDEOS,'videos',access,user);state.frasesDB=resources(state.frasesDB||CONTENT.DEFAULT_FRASES,'frases',access,user);const enrolled=enrollment(access,user.profile);if(state.progModulos)state.progModulos=Object.fromEntries(Object.entries(state.progModulos).filter(([pid])=>enrolled.includes(pid)).map(([pid,mods])=>[pid,mods.map(m=>({...m,content:unlocked(access,{id:pid},m.id)?m.content:''}))]));}
 return {state,versions};
}
function guard(db,kind,owner,version){return stmt(db,'INSERT INTO portal_assert(ok) SELECT 0 WHERE COALESCE((SELECT version FROM portal_records WHERE kind=? AND owner=?),0)<>?',kind,owner,version);}
async function patch(db,user,body){
 if(!Array.isArray(body.changes)||body.changes.length>100)deny(422,'Demasiados cambios.');
 const ops=[],seen=new Set(),versions={};
 for(const change of body.changes){const kind=change.key,owner=change.owner??'',value=change.value;
  if(typeof owner!=='string'||['__proto__','constructor','prototype'].includes(owner))deny(422,'Usuario inválido.');const id=kind+':'+owner;if(seen.has(id))deny(422,'Cambio duplicado.');seen.add(id);
  const expected=body.versions?.[id]??0;if(!Number.isInteger(expected)||expected<0)deny(422,'Versión inválida.');ops.push(guard(db,kind,owner,expected));versions[id]=expected+1;
  if(kind==='users'){
   if(user.role!=='admin')deny(403,'Sólo el administrador puede gestionar usuarios.');emailCheck(owner);const old=await stmt(db,'SELECT role FROM portal_accounts WHERE email=?',owner).first();
   if(value===null){if(owner===user.email)deny(422,'No podés eliminar tu propia cuenta.');ops.push(stmt(db,'DELETE FROM portal_sessions WHERE email=?',owner),stmt(db,'DELETE FROM portal_activation WHERE email=?',owner),stmt(db,'DELETE FROM portal_accounts WHERE email=?',owner),stmt(db,'DELETE FROM portal_records WHERE owner=? AND kind<>?',owner,'users'),write(db,kind,owner,null));continue;}
   const profile={name:text(value.name||'',120),email:owner,role:old?.role||'vendedor',prog:text(value.prog||'',80),progName:text(value.progName||'',150),progColor:/^#[0-9a-f]{6}$/i.test(value.progColor||'')?value.progColor:'#C8A55A',created:typeof value.created==='string'&&Number.isFinite(Date.parse(value.created))?new Date(value.created).toISOString():new Date().toISOString()};if(!profile.name)deny(422,'Completá el nombre.');
   const password=value.pass||'';if(!old||password){passwordCheck(password);const hash=await passwordHash(password);ops.push(stmt(db,'INSERT INTO portal_accounts(email,password_hash,role) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash',owner,hash,profile.role));if(old)ops.push(stmt(db,'DELETE FROM portal_sessions WHERE email=?',owner));}
   ops.push(write(db,kind,owner,profile));
  } else if(MAPS.includes(kind)){
   if(!owner)deny(422,'Falta el usuario.');if(user.role!=='admin'&&!(owner===user.email&&OWN.includes(kind)))deny(403,'No podés modificar esos datos.');
   const exists=await stmt(db,'SELECT email FROM portal_accounts WHERE email=?',owner).first();if(!exists&&!seen.has('users:'+owner))deny(422,'El usuario no existe.');plain(value);if(kind==='access'&&value!==null&&typeof value!=='object')deny(422,'Acceso inválido.');ops.push(write(db,kind,owner,value));
  } else if(kind==='reflexiones'){
   if(owner!==user.email&&user.role!=='admin')deny(403,'No podés cambiar otra reflexión.');if(!Array.isArray(value)||value.length>20)deny(422,'Reflexión inválida.');plain(value);const refs=value.map(r=>({...r,email:owner,...(user.role==='admin'?{}:{name:user.profile.name,approved:false})}));ops.push(write(db,kind,owner,refs));
  } else if(GLOBALS.includes(kind)&&user.role==='admin'&&!owner){
   if(kind==='programs'){if(!Array.isArray(value)||value.length>30)deny(422,'Programas inválidos.');value.forEach(p=>{text(p.name,150);text(p.id,80);if(p.mpLink&&!/^https:\/\/(?:www\.)?(?:mercadopago\.com(?:\.ar)?|mpago\.la)\//i.test(p.mpLink))deny(422,'Usá un enlace HTTPS de Mercado Pago.');});}
   if(kind==='progModulos'&&JSON.stringify(value).length>600000)deny(422,'Contenido demasiado grande.');ops.push(write(db,kind,owner,value));
  }else deny(403,'Campo no autorizado.');
 }
 try{if(ops.length)await db.batch(ops);}catch(e){if(String(e).includes('portal_conflict'))deny(409,'Otra sesión guardó cambios. Sincronizá antes de continuar.');throw e;}return {ok:true,versions};
}
async function api(request,env){
 const db=env.DB;if(!db)deny(503,'La base de datos no está conectada.');const url=new URL(request.url),route=url.pathname.replace(/^\/api\/?/,'').replace(/\/$/,'');const method=request.method;
 if(!['GET','POST','PATCH','DELETE'].includes(method))deny(405,'Método no permitido.');
 if(method!=='GET'&&request.headers.get('Origin')!==url.origin)deny(403,'Origen no autorizado.');const body=method==='GET'?{}:await bodyOf(request);
 if(route==='health'&&method==='GET'){await db.prepare('SELECT 1 FROM portal_accounts LIMIT 1').first();return json({ok:true,version:'cloudflare-portal-1'});}
 if(route==='programs'&&method==='GET'){const progs=(await programs(db)).map(({code,...p})=>p);return json({ok:true,programs:progs});}
 if(route==='testimonials'&&method==='GET'){const rows=(await db.prepare("SELECT data FROM portal_records WHERE kind='reflexiones' AND data IS NOT NULL").all()).results;return json({ok:true,testimonials:rows.flatMap(r=>JSON.parse(r.data)).filter(r=>r.approved&&r.public).slice(0,30).map(r=>({name:r.publicName||r.name,text:r.text,programa:r.programa,stars:r.stars}))});}
 if(route==='contact'&&method==='POST'){
  await limit(db,'contact:'+(request.headers.get('CF-Connecting-IP')||'local'),8,3600);if(body.website)return json({ok:true});const name=text(body.name||'',120),email=emailCheck(body.email),phone=text(body.phone||'',40),interest=text(body.interest||'',150),message=text(body.message||'',4000);if(!name||!message)deny(422,'Completá tu nombre y mensaje.');await stmt(db,'INSERT INTO portal_contacts(id,name,email,phone,interest,message) VALUES(?,?,?,?,?,?)',crypto.randomUUID(),name,email,phone,interest,message).run();return json({ok:true},201);
 }
 if(route==='activate'&&method==='POST'){
  await limit(db,'activate:'+(request.headers.get('CF-Connecting-IP')||'local'),10,900);passwordCheck(body.pass);const hash=await digest(String(body.token||'')),now=Math.floor(Date.now()/1000);const token=await stmt(db,'SELECT email FROM portal_activation WHERE token_hash=? AND expires>?',hash,now).first();if(!token)deny(403,'El enlace venció o ya se utilizó.');const password=await passwordHash(body.pass);
  try{await db.batch([stmt(db,'INSERT INTO portal_assert(ok) SELECT 0 WHERE NOT EXISTS(SELECT 1 FROM portal_activation WHERE token_hash=? AND expires>?)',hash,now),stmt(db,'UPDATE portal_accounts SET password_hash=? WHERE email=?',password,token.email),stmt(db,'DELETE FROM portal_activation WHERE email=?',token.email),stmt(db,'DELETE FROM portal_sessions WHERE email=?',token.email)]);}catch(e){if(String(e).includes('portal_conflict'))deny(403,'El enlace ya se utilizó.');throw e;}return json({ok:true});
 }
 if(route==='login'&&method==='POST'){
  const email=emailCheck(body.email);await limit(db,'login:'+(request.headers.get('CF-Connecting-IP')||'local')+':'+email,10,900);const account=await stmt(db,'SELECT email,password_hash,role,active FROM portal_accounts WHERE email=?',email).first();if(!account||!account.active||!await passwordValid(String(body.pass||''),account.password_hash))deny(401,'Email o contraseña incorrectos.');
  const token=random(),csrf=random();await stmt(db,'INSERT INTO portal_sessions(token_hash,email,csrf,expires) VALUES(?,?,?,?)',await digest(token),email,csrf,Math.floor(Date.now()/1000)+28800).run();return json({ok:true,user:{...await record(db,'users',email),email,role:account.role},csrf},200,{'Set-Cookie':`__Host-ds_portal=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`});
 }
 const user=await auth(request,db);if(method!=='GET'&&!same(user.csrf,request.headers.get('X-CSRF-Token')))deny(403,'Sesión inválida. Recargá la página.');
 if(route==='me'&&method==='GET')return json({ok:true,user:user.profile,csrf:user.csrf});
 if(route==='logout'&&method==='POST'){await stmt(db,'DELETE FROM portal_sessions WHERE token_hash=?',user.token_hash).run();return json({ok:true},200,{'Set-Cookie':'__Host-ds_portal=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'});}
 if(route==='password'&&method==='POST'){const account=await stmt(db,'SELECT password_hash FROM portal_accounts WHERE email=?',user.email).first();if(!await passwordValid(body.current,account.password_hash))deny(401,'La contraseña actual es incorrecta.');passwordCheck(body.pass);await db.batch([stmt(db,'UPDATE portal_accounts SET password_hash=? WHERE email=?',await passwordHash(body.pass),user.email),stmt(db,'DELETE FROM portal_sessions WHERE email=? AND token_hash<>?',user.email,user.token_hash)]);return json({ok:true});}
 if(route==='state'&&method==='GET')return json({ok:true,...await snapshot(db,user)});
 if(route==='state'&&method==='PATCH')return json(await patch(db,user,body));
 if(route==='content'&&method==='GET'){
  const access=await accessInfo(db,user),enrolled=enrollment(access,user.profile),data={};for(const [type,[modKey,examKey]] of Object.entries(TYPES)){data[modKey]=[];data[examKey]={};for(const prog of await programs(db)){if(prog.type!==type)continue;const list=await modules(db,prog);const eligible=user.role==='admin'||enrolled.includes(prog.id);if(!eligible)continue;data[modKey].push(...list.map(m=>({...m,content:eligible&&(user.role==='admin'||unlocked(access,prog,m.id))?m.content:''})));if(eligible)for(const m of list){if(user.role!=='admin'&&!unlocked(access,prog,m.id))continue;const questions=CONTENT[examKey][m.id]||[];data[examKey][m.id]=questions.map(({correct,...q})=>q);}}}
  data.ALL_CASOS_INMOBILIARIO=user.role==='admin'||enrolled.includes('prog1')?CONTENT.ALL_CASOS_INMOBILIARIO:[];const tools=[...(access.herramientas||[]),...Object.values(access.byProg||{}).flatMap(p=>p.herramientas||[])];data.ALL_HERRAMIENTAS=CONTENT.ALL_HERRAMIENTAS.map(t=>({...t,content:user.role==='admin'||tools.includes(t.id)?t.content:''}));data.DEFAULT_VIDEOS=resources(await record(db,'videosDB')||CONTENT.DEFAULT_VIDEOS,'videos',access,user);data.DEFAULT_FRASES=resources(await record(db,'frasesDB')||CONTENT.DEFAULT_FRASES,'frases',access,user);return json({ok:true,content:data});
 }
 if(route==='exam'&&method==='POST'){
  await limit(db,'exam:'+user.email,50,3600);const {prog}=await allowedModule(db,user,body.moduleId);const questions=CONTENT[TYPES[prog.type]?.[1]||'ALL_EXAMENES'][body.moduleId];if(!questions?.length||!Array.isArray(body.answers)||body.answers.length!==questions.length||body.answers.some(n=>!Number.isInteger(n)||n<0||n>3))deny(422,'Respondé todas las preguntas.');const correct=questions.map((q,i)=>q.correct===body.answers[i]);const score=correct.filter(Boolean).length;const result={score,total:questions.length,approved:score>=Math.ceil(questions.length*.8),date:new Date().toISOString()};
  const row=await stmt(db,"SELECT data,version FROM portal_records WHERE kind='exams' AND owner=?",user.email).first();const exams=row?.data?JSON.parse(row.data):{};exams[body.moduleId]=result;const ops=[guard(db,'exams',user.email,row?.version||0),write(db,'exams',user.email,exams)];
  if(result.approved){const p=await stmt(db,"SELECT data,version FROM portal_records WHERE kind='progress' AND owner=?",user.email).first();const progress=p?.data?JSON.parse(p.data):{modulos:[],herramientas:[]};progress.modulos=[...new Set([...(progress.modulos||[]),body.moduleId])];ops.push(guard(db,'progress',user.email,p?.version||0),write(db,'progress',user.email,progress));}
  try{await db.batch(ops);}catch(e){if(String(e).includes('portal_conflict'))deny(409,'Hubo otro cambio de progreso. Probá de nuevo.');throw e;}return json({ok:true,result,correct});
 }
 if(route==='tool'&&method==='POST'){
  const access=await accessInfo(db,user);const allowed=[...(access.herramientas||[]),...Object.values(access.byProg||{}).flatMap(p=>p.herramientas||[])];if(user.role!=='admin'&&!allowed.includes(body.id))deny(403,'Herramienta no habilitada.');const p=await stmt(db,"SELECT data,version FROM portal_records WHERE kind='progress' AND owner=?",user.email).first();const progress=p?.data?JSON.parse(p.data):{modulos:[],herramientas:[]};progress.herramientas=[...new Set([...(progress.herramientas||[]),body.id])];await db.batch([guard(db,'progress',user.email,p?.version||0),write(db,'progress',user.email,progress)]);return json({ok:true});
 }
 if(route==='certificate'&&method==='POST'){
  const email=user.role==='admin'&&body.email?emailCheck(body.email):user.email;const profile=await record(db,'users',email);if(!profile)deny(404,'Usuario inexistente.');const prog=(await programs(db)).find(p=>p.id===(body.progId||profile.prog));if(!prog)deny(422,'Programa inválido.');const mods=await modules(db,prog);if(user.role!=='admin'){const access=await accessInfo(db,user),exams=await record(db,'exams',email)||{};if(!enrollment(access,user.profile).includes(prog.id)||!mods.length||!mods.every(m=>exams[m.id]?.approved))deny(403,'Tenés que aprobar todos los módulos del programa.');}
  const current=await record(db,'certs',email)||[];let cert=current.find(c=>c.progId===prog.id);if(!cert){cert={id:crypto.randomUUID(),email,name:profile.name,progId:prog.id,progName:prog.name,modules:mods.length,fecha:new Date().toISOString(),sentByEmail:false};await write(db,'certs',email,[cert,...current]).run();}return json({ok:true,cert});
 }
 if(route==='contacts'&&user.role==='admin'&&method==='GET')return json({ok:true,contacts:(await db.prepare('SELECT * FROM portal_contacts ORDER BY created_at DESC LIMIT 200').all()).results});
 if(route==='contacts'&&user.role==='admin'&&method==='PATCH'){await stmt(db,'UPDATE portal_contacts SET handled=? WHERE id=?',body.handled?1:0,String(body.id)).run();return json({ok:true});}
 if(route==='activation-link'&&user.role==='admin'&&method==='POST'){const email=emailCheck(body.email);if(!await stmt(db,'SELECT email FROM portal_accounts WHERE email=?',email).first())deny(404,'Usuario inexistente.');const token=random();await db.batch([stmt(db,'DELETE FROM portal_activation WHERE email=?',email),stmt(db,'INSERT INTO portal_activation(token_hash,email,expires) VALUES(?,?,?)',await digest(token),email,Math.floor(Date.now()/1000)+259200)]);return json({ok:true,url:url.origin+'/activar.html#token='+token});}
 if(route==='status'&&user.role==='admin'&&method==='POST'){const email=emailCheck(body.email);if(email===user.email)deny(422,'No podés suspender tu propia cuenta.');await db.batch([stmt(db,'UPDATE portal_accounts SET active=? WHERE email=?',body.active?1:0,email),stmt(db,'DELETE FROM portal_sessions WHERE email=?',email)]);return json({ok:true});}
 deny(404,'Ruta no disponible.');
}
export default {
 async fetch(request,env,ctx){
  try{
   const url=new URL(request.url);
   if(url.pathname.startsWith('/api/'))return await api(request,env);
   if(url.pathname==='/instalar.html'||url.pathname==='/api/index.php'||url.pathname.startsWith('/config/')||url.pathname.startsWith('/database/'))return new Response('No disponible',{status:404});
   if(url.pathname==='/portal.html'||url.pathname==='/portal'){
    const response=await env.ASSETS.fetch(new Request(new URL('/portal.html',url),request));const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-Frame-Options','DENY');headers.set('Referrer-Policy','strict-origin-when-cross-origin');headers.set('X-Content-Type-Options','nosniff');return new Response(response.body,{status:response.status,headers});
   }
   const response=await env.ASSETS.fetch(request);const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','strict-origin-when-cross-origin');return new Response(response.body,{status:response.status,headers});
  }catch(e){if(e instanceof HttpError)return json({ok:false,error:e.message},e.status);console.error(JSON.stringify({event:'portal_error',path:new URL(request.url).pathname,message:String(e.message).slice(0,200)}));return json({ok:false,error:'No se pudo completar la operación. Probá nuevamente.'},503);}
 }
};
