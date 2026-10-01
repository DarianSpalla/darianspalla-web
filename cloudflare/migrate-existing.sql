-- Preserve the original tables and profiles; old password hashes remain untouched.
INSERT OR IGNORE INTO portal_accounts(email,role,active,created_at)
 SELECT lower(email),CASE WHEN role='admin' THEN 'admin' ELSE 'vendedor' END,CASE WHEN status='active' THEN 1 ELSE 0 END,created_at FROM users;
INSERT OR IGNORE INTO portal_records(kind,owner,data)
 SELECT 'users',lower(u.email),json_object('email',lower(u.email),'name',u.name,'role',CASE WHEN u.role='admin' THEN 'admin' ELSE 'vendedor' END,'prog',u.program_id,'progName',coalesce(p.name,'Coaching'),'created',u.created_at)
 FROM users u LEFT JOIN programs p ON p.id=u.program_id;
INSERT OR IGNORE INTO portal_records(kind,owner,data)
 SELECT 'access',lower(email),json_object('programs',json_array(program_id),'byProg',json_object(program_id,json_object('modulos',json_array(),'herramientas',json_array())),'modulos',json_array(),'herramientas',json_array(),'videos',json_array(),'frases',json_array()) FROM users;
INSERT OR IGNORE INTO portal_records(kind,owner,data)
 SELECT 'programs','',json_group_array(json_object('id',id,'name',name,'color',color,'type',CASE id WHEN 'prog2' THEN 'vida' WHEN 'prog3' THEN 'liderazgo' ELSE 'inmobiliario' END,'code','','precio','','precioDesc','','mpLink','')) FROM programs WHERE is_active=1;
