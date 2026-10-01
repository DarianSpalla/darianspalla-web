<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function reply(int $status, array $data): void { http_response_code($status); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }
function fail(int $status, string $message): void { reply($status, ['ok'=>false,'error'=>$message]); }
function encode($value): string { return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE); }
try {
 $file=dirname(__DIR__,2).'/portal-private/config.php';
 if (!is_file($file)) fail(503,'Falta configurar la base de datos en Hostinger.');
 $config=require $file;
 $pdo=new PDO('mysql:host='.$config['host'].';dbname='.$config['database'].';charset=utf8mb4',$config['username'],$config['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
 ini_set('session.use_strict_mode','1');
 session_name('ds_portal');
 session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
 session_start();
 $method=$_SERVER['REQUEST_METHOD']; $route=trim($_GET['route']??'me','/');
 $body=[];
 if ($method!=='GET') {
  if (($_SERVER['HTTP_ORIGIN']??'')!==$config['origin']) fail(403,'Origen no autorizado.');
  if ((int)($_SERVER['CONTENT_LENGTH']??0)>2000000) fail(413,'Solicitud demasiado grande.');
  $body=json_decode(file_get_contents('php://input'),true,512,JSON_THROW_ON_ERROR);
  if (!is_array($body)) fail(400,'Solicitud inválida.');
 }
 if ($route==='setup' && $method==='POST') {
  if (strlen($config['setup_token']??'')<32 || str_starts_with($config['setup_token'],'REEMPLAZAR') || !hash_equals($config['setup_token'],(string)($body['token']??''))) fail(403,'Token de instalación inválido.');
  $pdo->beginTransaction();
  $pdo->query('SELECT id FROM portal_state WHERE id=1 FOR UPDATE')->fetch();
  if ($pdo->query('SELECT COUNT(*) FROM portal_users')->fetchColumn()>0) fail(409,'La instalación ya está cerrada.');
  $email=strtolower(trim($body['email']??'')); $pass=$body['pass']??'';
  if (!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($pass)<10||!trim($body['name']??'')) fail(422,'Completá nombre, email y contraseña de al menos 10 caracteres.');
  $profile=['email'=>$email,'name'=>trim($body['name']),'role'=>'admin','created'=>gmdate('c')];
  $pdo->prepare('INSERT INTO portal_users (email,password_hash,profile) VALUES (?,?,?)')->execute([$email,password_hash($pass,PASSWORD_DEFAULT),encode($profile)]);
  $pdo->commit(); reply(201,['ok'=>true]);
 }
 if ($route==='login' && $method==='POST') {
  $email=strtolower(trim($body['email']??'')); $bucket=hash('sha256',($_SERVER['REMOTE_ADDR']??'').':'.$email); $now=time();
  $pdo->beginTransaction();
  $pdo->prepare('INSERT IGNORE INTO portal_login_limits (bucket,started) VALUES (?,?)')->execute([$bucket,$now]);
  $q=$pdo->prepare('SELECT * FROM portal_login_limits WHERE bucket=? FOR UPDATE');$q->execute([$bucket]);$limit=$q->fetch(PDO::FETCH_ASSOC);
  $attempts=$now-(int)$limit['started']>900?0:(int)$limit['attempts'];
  if ($attempts>=10) { $pdo->commit(); fail(429,'Demasiados intentos. Probá en 15 minutos.'); }
  $pdo->prepare('UPDATE portal_login_limits SET attempts=?, started=? WHERE bucket=?')->execute([$attempts+1,$attempts===0?$now:$limit['started'],$bucket]);$pdo->commit();
  $q=$pdo->prepare('SELECT * FROM portal_users WHERE email=?');$q->execute([$email]);$u=$q->fetch(PDO::FETCH_ASSOC);
  if (!$u||!$u['active']||!password_verify((string)($body['pass']??''),$u['password_hash'])) fail(401,'Email o contraseña incorrectos.');
  $pdo->prepare('DELETE FROM portal_login_limits WHERE bucket=?')->execute([$bucket]);
  session_regenerate_id(true); $_SESSION=['email'=>$email,'expires'=>time()+28800,'csrf'=>bin2hex(random_bytes(32))];
 }
 if (empty($_SESSION['email'])||($_SESSION['expires']??0)<time()) fail(401,'Ingresá al portal.');
 $q=$pdo->prepare('SELECT * FROM portal_users WHERE email=? AND active=1');$q->execute([$_SESSION['email']]);$u=$q->fetch(PDO::FETCH_ASSOC);
 if (!$u) {session_destroy();fail(401,'Cuenta deshabilitada.');}
 $profile=json_decode($u['profile'],true);$admin=$profile['role']==='admin';$email=$u['email'];
 if ($method!=='GET' && $route!=='login' && !hash_equals($_SESSION['csrf'],$_SERVER['HTTP_X_CSRF_TOKEN']??'')) fail(403,'Sesión inválida. Recargá la página.');
 if ($route==='logout' && $method==='POST') {session_destroy();setcookie(session_name(),'', ['expires'=>time()-3600,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);reply(200,['ok'=>true]);}
 if ($route==='login'||$route==='me') reply(200,['ok'=>true,'user'=>$profile,'csrf'=>$_SESSION['csrf']]);
 $own=['diags','progress','msgs_v2','exams','frasesUser','moduleNotes','modulePlan','lastSeenReplies'];
 $maps=array_merge($own,['replies','badgesEarned','access']);
 $globals=['programs','progModulos','videosDB','frasesDB','emailConfig','certs'];
 if ($route==='state' && $method==='GET') {
  $row=$pdo->query('SELECT * FROM portal_state WHERE id=1')->fetch(PDO::FETCH_ASSOC);$state=json_decode($row['data'],true);
  $state['users']=[];
  $q=$admin?$pdo->query('SELECT email,profile FROM portal_users'):$pdo->prepare('SELECT email,profile FROM portal_users WHERE email=?');if(!$admin)$q->execute([$email]);
  foreach($q->fetchAll(PDO::FETCH_ASSOC) as $item)$state['users'][$item['email']]=json_decode($item['profile'],true);
  if(!$admin) {
   foreach($maps as $key)$state[$key]=isset($state[$key][$email])?[$email=>$state[$key][$email]]:new stdClass();
   $state['reflexiones']=array_values(array_filter($state['reflexiones']??[],fn($r)=>($r['email']??'')===$email));
   $state['certs']=array_values(array_filter($state['certs']??[],fn($r)=>($r['email']??'')===$email));
   if(isset($state['programs']))foreach($state['programs'] as &$program)unset($program['code']);unset($program);
  }
  reply(200,['ok'=>true,'state'=>$state,'revision'=>(int)$row['revision']]);
 }
 if ($route==='state' && $method==='PATCH') {
  $pdo->beginTransaction();$row=$pdo->query('SELECT * FROM portal_state WHERE id=1 FOR UPDATE')->fetch(PDO::FETCH_ASSOC);
  if ((int)($body['revision']??-1)!==(int)$row['revision']) fail(409,'Los datos cambiaron en otra sesión. Recargá antes de guardar.');
  $state=json_decode($row['data'],true);
  foreach($body['changes']??[] as $change) {
   $key=$change['key']??'';$owner=$change['owner']??null;$value=$change['value']??null;
   if($key==='users') {
    if(!$admin||!is_string($owner)||!filter_var($owner,FILTER_VALIDATE_EMAIL))fail(403,'Acción no autorizada.');
    $q=$pdo->prepare('SELECT profile FROM portal_users WHERE email=?');$q->execute([$owner]);$old=$q->fetchColumn();
    if($value===null){if($owner===$email)fail(422,'No podés eliminar tu propia cuenta.');$pdo->prepare('DELETE FROM portal_users WHERE email=?')->execute([$owner]);foreach($maps as $k)unset($state[$k][$owner]);continue;}
    if(!is_array($value)||!trim($value['name']??''))fail(422,'Nombre inválido.');
    $pass=$value['pass']??'';unset($value['pass']);$value['email']=$owner;$value['role']=$old?(json_decode($old,true)['role']??'vendedor'):'vendedor';
    if(!$old&&strlen($pass)<10)fail(422,'La contraseña debe tener al menos 10 caracteres.');
    if($pass!==''&&strlen($pass)<10)fail(422,'La contraseña debe tener al menos 10 caracteres.');
    if(!$old)$pdo->prepare('INSERT INTO portal_users(email,password_hash,profile) VALUES(?,?,?)')->execute([$owner,password_hash($pass,PASSWORD_DEFAULT),encode($value)]);
    else { $pdo->prepare('UPDATE portal_users SET profile=? WHERE email=?')->execute([encode($value),$owner]);if($pass!=='')$pdo->prepare('UPDATE portal_users SET password_hash=? WHERE email=?')->execute([password_hash($pass,PASSWORD_DEFAULT),$owner]); }
   } elseif(in_array($key,$maps,true)) {
    if(!is_string($owner)||(!$admin&&($owner!==$email||!in_array($key,$own,true))))fail(403,'Acción no autorizada.');
    if($value===null)unset($state[$key][$owner]);else $state[$key][$owner]=$value;
   } elseif($key==='reflexiones') {
    if(!is_array($value))fail(422,'Reflexiones inválidas.');
    if($admin)$state[$key]=$value;else {$others=array_filter($state[$key]??[],fn($r)=>($r['email']??'')!==$email);foreach($value as $r)if(($r['email']??'')!==$email)fail(403,'Acción no autorizada.');$state[$key]=array_values(array_merge($others,$value));}
   } elseif(in_array($key,$globals,true)&&$admin)$state[$key]=$value;
   else fail(403,'Acción no autorizada.');
  }
  $pdo->prepare('UPDATE portal_state SET data=?,revision=revision+1 WHERE id=1')->execute([encode($state)]);$pdo->commit();reply(200,['ok'=>true,'revision'=>(int)$row['revision']+1]);
 }
 fail(404,'Ruta no disponible.');
} catch(JsonException $e) {fail(400,'JSON inválido.');} catch(Throwable $e) {if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();error_log('Portal API: '.$e->getMessage());fail(503,'No se pudo completar la operación. Revisá la configuración del servidor.');}
