const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const safe=user=>{const {pass,passwordHash,passwordSalt,...rest}=user;return rest};
async function hash(pass,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveBits']);return Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256))).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function secure(user){const copy={...user};if(copy.pass){copy.passwordSalt=crypto.randomUUID();copy.passwordHash=await hash(copy.pass,copy.passwordSalt);delete copy.pass}return copy}
export default {async fetch(req,env){
 const url=new URL(req.url);
 if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(req);
 const path=url.pathname.slice(4).replace(/\/$/,'');const method=req.method;
 if(method==='OPTIONS')return new Response(null,{status:204});
 if(req.headers.get('Origin')&&req.headers.get('Origin')!==url.origin)return json({error:'Origen no autorizado'},403);
 if(path==='/health')return json({ok:true,service:'Darian Coaching',v:5});
 if(!env.DB)return json({error:'Falta configurar la base de datos'},503);
 try{
 if(Number(req.headers.get('Content-Length')||0)>1000000)return json({error:'Solicitud demasiado grande'},413);
 if(path==='/login'&&method==='POST'){
  const {email:raw,pass}=await req.json();const email=String(raw||'').trim().toLowerCase();
  if(!email||typeof pass!=='string'||pass.length>256)return json({error:'Credenciales inválidas'},400);
  if(!env.LOGIN_LIMITER)return json({error:'Falta configurar la protección del acceso'},503);
  const limit=await env.LOGIN_LIMITER.limit({key:req.headers.get('CF-Connecting-IP')||'unknown'});if(!limit.success)return json({error:'Demasiados intentos. Volvé a intentar en un minuto.'},429);
  const users=await env.DB.get('users',{type:'json'})||{};const user=users[email];
  let valid=false;
  if(user?.role==='admin'){valid=!!env.ADMIN_PASSWORD&&await hash(pass,email)===await hash(env.ADMIN_PASSWORD,email)}
  else if(user){valid=user.passwordHash?await hash(pass,user.passwordSalt)===user.passwordHash:user.pass===pass}
  if(!valid)return json({error:'Email o contraseña incorrectos'},401);
  if(user.pass){users[email]=await secure(user);await env.DB.put('users',JSON.stringify(users))}
  const token=crypto.randomUUID()+crypto.randomUUID();await env.DB.put('session:'+token,JSON.stringify({email,role:user.role}),{expirationTtl:28800});
  const access=await env.DB.get('access',{type:'json'})||{};return json({ok:true,token,user:safe(user),access:access[email]||{}});
 }
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');
 const session=token?await env.DB.get('session:'+token,{type:'json'}):null;
 if(!session)return json({error:'Ingresá nuevamente para continuar'},401);
 const users=await env.DB.get('users',{type:'json'})||{};const current=users[session.email];
 if(!current)return json({error:'Cuenta no disponible'},401);
 const admin=current.role==='admin';
 if(path.startsWith('/access/')&&method==='GET'){
  const email=decodeURIComponent(path.slice(8));if(!admin&&email!==session.email)return json({error:'Sin permiso'},403);
  if(!users[email])return json({error:'Usuario no encontrado'},404);const access=await env.DB.get('access',{type:'json'})||{};return json({user:safe(users[email]),access:access[email]||{}});
 }
 if(path==='/users'&&method==='POST'){
  const {email,userData,accessData}=await req.json();if(typeof email!=='string'||!userData)return json({error:'Datos incompletos'},400);
  if(!admin&&email!==session.email)return json({error:'Sin permiso'},403);
  const updated=admin?{...users[email],...userData}:{...users[email],name:userData.name||users[email].name};
  users[email]=await secure(updated);await env.DB.put('users',JSON.stringify(users));
  if(admin&&accessData){const access=await env.DB.get('access',{type:'json'})||{};access[email]=accessData;await env.DB.put('access',JSON.stringify(access))}return json({ok:true});
 }
 if(path==='/programs'&&method==='GET'){const programs=await env.DB.get('programs',{type:'json'})||[];return json({programs:admin?programs:programs.map(({code,...rest})=>rest)})}
 if(!admin)return json({error:'Sin permiso'},403);
 if((path==='/users'||path==='/sync')&&method==='GET'){
  const access=await env.DB.get('access',{type:'json'})||{};const result={users:Object.fromEntries(Object.entries(users).map(([email,u])=>[email,safe(u)])),access};
  if(path==='/sync'){result.programs=await env.DB.get('programs',{type:'json'});result.certs=await env.DB.get('certs',{type:'json'})||[]}return json(result);
 }
 if(path==='/sync'&&method==='POST'){
  const body=await req.json();if(body.users){for(const [email,u] of Object.entries(body.users))users[email]=await secure({...users[email],...u});await env.DB.put('users',JSON.stringify(users))}
  for(const key of ['access','programs','certs'])if(body[key])await env.DB.put(key,JSON.stringify(body[key]));return json({ok:true});
 }
 if(path.startsWith('/users/')){
  const email=decodeURIComponent(path.slice(7));if(email===session.email&&method==='DELETE')return json({error:'No podés eliminar tu propia cuenta'},400);
  const access=await env.DB.get('access',{type:'json'})||{};
  if(method==='DELETE'){delete users[email];delete access[email]}
  else if(method==='PUT'){const body=await req.json();users[email]=await secure({...users[email],...body.userData});if(body.accessData)access[email]={...access[email],...body.accessData}}
  else return json({error:'Método no permitido'},405);
  await env.DB.put('users',JSON.stringify(users));await env.DB.put('access',JSON.stringify(access));return json({ok:true});
 }
 if(path==='/certs'&&method==='POST'){const body=await req.json();const certs=await env.DB.get('certs',{type:'json'})||[];certs.unshift({...body,fecha:new Date().toISOString()});await env.DB.put('certs',JSON.stringify(certs));return json({ok:true})}
 return json({error:'No encontrado'},404);
 }catch{return json({error:'No se pudo completar la solicitud'},500)}
}};
