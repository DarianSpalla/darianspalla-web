/* Server-backed adapter for the existing portal. No passwords or student data in localStorage. */
(function () {
 'use strict';
 const copy = x => JSON.parse(JSON.stringify(x));
 const maps = ['users','access','diags','progress','msgs_v2','replies','exams','frasesUser','badgesEarned','moduleNotes','modulePlan','lastSeenReplies'];
 const own = ['diags','progress','msgs_v2','exams','frasesUser','moduleNotes','modulePlan','lastSeenReplies'];
 const globals = ['programs','progModulos','videosDB','frasesDB','emailConfig','certs','reflexiones'];
 let state = {}, saved = {}, revision = 0, csrf = '', timer, busy = false, blocked = false;
 const nativeFetch = window.fetch.bind(window);
 const status = document.createElement('div');
 status.style.cssText='position:fixed;bottom:12px;right:12px;z-index:99999;background:#171717;color:#fff;padding:10px;border-radius:8px;font:13px sans-serif;display:none';
 status.setAttribute('role','status');document.body.appendChild(status);
 function notify(text){status.textContent=text;status.style.display=text?'block':'none';}
 async function api(route, method='GET', body){
  const response=await nativeFetch('/api/index.php?route='+encodeURIComponent(route),{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},...(body?{body:JSON.stringify(body)}:{})});
  let data;try{data=await response.json();}catch(e){throw new Error('La API PHP no está instalada en Hostinger.');}
  if(!response.ok) {const error=new Error(data.error||'No se pudo guardar.');error.status=response.status;throw error;}return data;
 }
 window.getDB=()=>copy(state);
 function permitted(key,owner){return CU&&(CU.role==='admin'||(own.includes(key)&&owner===CU.email)||key==='reflexiones');}
 function diff(){const out=[];
  for(const key of maps)for(const owner of new Set([...Object.keys(saved[key]||{}),...Object.keys(state[key]||{})])){
   if(permitted(key,owner)&&JSON.stringify((saved[key]||{})[owner])!==JSON.stringify((state[key]||{})[owner]))out.push({key,owner,value:(state[key]||{})[owner]??null});
  }
  for(const key of globals)if(permitted(key)&&JSON.stringify(saved[key])!==JSON.stringify(state[key]))out.push({key,value:state[key]??null});return out;
 }
 window.saveDB=function(value){state=copy(value);if(!CU||blocked)return;clearTimeout(timer);timer=setTimeout(()=>flush().catch(()=>{}),300);};
 async function flush(){
  if(busy){await new Promise(resolve=>setTimeout(resolve,30));return flush();}
  if(blocked)throw new Error('Recargá para resolver el conflicto de datos.');
  const changes=diff();if(!changes.length)return;
  busy=true;const snapshot=copy(state);notify('Guardando en el servidor…');
  try{const data=await api('state','PATCH',{revision,changes});revision=data.revision;saved=snapshot;
   for(const change of changes)if(change.key==='users'&&change.value){delete saved.users[change.owner].pass;if(state.users?.[change.owner]?.pass===change.value.pass)delete state.users[change.owner].pass;}
   notify('Guardado en MySQL');setTimeout(()=>{if(!busy&&!diff().length)notify('');},2000);
  }catch(error){if(error.status===409)blocked=true;notify(error.message+' Los cambios pendientes siguen en esta pestaña.');throw error;}finally{busy=false;}
  if(diff().length)return flush();
 }
 async function hydrate(){const data=await api('state');state=copy(data.state);for(const key of maps)state[key]=Object.assign({},state[key]||{});saved=copy(state);revision=data.revision;blocked=false;}
 async function enter(data){csrf=data.csrf;CU=data.user;await hydrate();showPortal();}
 window.doLogin=async function(){const err=document.getElementById('login-err');err.textContent='Verificando…';err.classList.add('show');try{await enter(await api('login','POST',{email:document.getElementById('login-email').value.trim().toLowerCase(),pass:document.getElementById('login-pass').value}));err.classList.remove('show');}catch(e){CU=null;err.textContent=e.message;}};
 window.doLogout=async function(){try{await flush();await api('logout','POST');CU=null;state={};saved={};csrf='';location.reload();}catch(e){notify(e.message);}};
 window.loadSyncConfig=function(){SYNC_CONFIG={workerUrl:'/api',adminKey:'',enabled:false};CF_WORKER_URL='/api';};
 window.saveSyncConfig=()=>notify('La conexión se configura en Hostinger.');
 window.syncFromCloud=function(callback){flush().then(hydrate).then(()=>{if(callback)callback(true);}).catch(e=>{notify(e.message);if(callback)callback(false);});};
 window.syncUserToCloud=function(email,user,callback){flush().then(()=>callback&&callback(true)).catch(()=>callback&&callback(false));};
 window.updateSyncBanner=()=>{const el=document.getElementById('sync-status');if(el)el.textContent='Conectado a MySQL en Hostinger';};
 window.saveSyncConfigUI=()=>notify('La conexión MySQL ya se configura en el archivo privado de Hostinger.');
 loadSyncConfig();
 // Legacy cloud endpoints are retired; database writes go exclusively through the state API.
 window.fetch=function(url,options){if(typeof url==='string'&&(/^\/api(?:\/|$)/.test(url))&&!url.startsWith('/api/index.php'))return Promise.reject(new Error('Endpoint anterior deshabilitado.'));return nativeFetch(url,options);};
 window.saveNewUser=async function(){const el=id=>document.getElementById(id),err=el('au-err');
  const name=el('au-name').value.trim(),email=el('au-email').value.trim().toLowerCase(),pass=el('au-pass').value,progId=el('au-prog').value;
  try{if(!name||!email.includes('@')||pass.length<10)throw new Error('Completá nombre, email y contraseña de al menos 10 caracteres.');if(state.users?.[email])throw new Error('Ese email ya existe.');
   await flush();const before=copy(state),prog=getProgs().find(p=>p.id===progId)||{};
   state.users=state.users||{};state.users[email]={name,email,pass,role:'vendedor',prog:progId,progName:prog.name||'Coaching',created:new Date().toISOString()};
   state.access=state.access||{};state.access[email]={programs:[progId],byProg:{[progId]:{modulos:[],herramientas:[],videos:[],frases:[]}},modulos:[],herramientas:[],videos:[],frases:[]};
   try{await flush();}catch(e){state=before;throw e;}
   el('au-pass').value='';closeModal('modal-add-user');loadAdminUsuarios();alert('Usuario creado en MySQL. Ya puede ingresar.');
  }catch(e){err.textContent=e.message;err.classList.add('show');}
 };
 // Existing edit/delete handlers save through saveDB; their alert is shown only after the server acknowledges.
 const originalAlert=window.alert.bind(window);
 window.alert=function(message){if(CU&&diff().length){flush().then(()=>originalAlert(message)).catch(e=>originalAlert(e.message));}else originalAlert(message);};
 window.addEventListener('beforeunload',event=>{if(busy||diff().length){event.preventDefault();event.returnValue='';}});
 // Preserve old progress for a future explicit migration; remove legacy plaintext passwords.
 for(const key of ['coaching_portal','cdb3','coaching_db2','coaching_db']){try{const old=JSON.parse(localStorage.getItem(key)||'null');if(old){for(const user of Object.values(old.users||{}))delete user.pass;localStorage.setItem(key,JSON.stringify(old));}}catch(e){console.warn('No se pudo limpiar el archivo local anterior.');}}
 sessionStorage.removeItem('ds_token');sessionStorage.removeItem('cu3');
 api('me').then(enter).catch(e=>{if(e.status!==401)notify(e.message);});
})();
