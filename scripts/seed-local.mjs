import fs from 'node:fs/promises';import {passwordHash} from '../src/worker.js';import {randomBytes} from 'node:crypto';
const pass=randomBytes(20).toString('base64url'),email='admin@test.invalid',hash=await passwordHash(pass);
const progs=[{id:'prog1',name:'Coaching Inmobiliario',type:'inmobiliario',color:'#C8A55A'},{id:'prog2',name:'Coaching de Vida',type:'vida',color:'#5A9AC8'},{id:'prog3',name:'Liderazgo Cristiano',type:'liderazgo',color:'#7C5AC8'}];
const quote=x=>"'"+x.replaceAll("'","''")+"'";
await fs.mkdir('/tmp/darian-test',{recursive:true,mode:0o700});await fs.writeFile('/tmp/darian-test/auth.json',JSON.stringify({email,pass}),{mode:0o600});
await fs.writeFile('/tmp/darian-test/seed.sql',`INSERT OR REPLACE INTO portal_accounts(email,password_hash,role) VALUES(${quote(email)},${quote(hash)},'admin'); INSERT OR REPLACE INTO portal_records(kind,owner,data) VALUES('users',${quote(email)},${quote(JSON.stringify({name:'Admin de prueba',email,role:'admin',prog:'prog1'}))}),('programs','',${quote(JSON.stringify(progs))});`,{mode:0o600});
