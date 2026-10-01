let pendingLogin;
function login(message='Ingresá con tu cuenta autorizada.'){
  if(pendingLogin)return pendingLogin;
  pendingLogin=new Promise(resolve=>{
    const panel=document.createElement('dialog');panel.className='login-dialog';
    panel.innerHTML='<form><img src="/therapy-logo-black.png" alt="Therapy"><h1>Ingresar al portal</h1><p class="login-message"></p><label>Correo<input name="email" type="email" autocomplete="username" required></label><label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label><p class="login-error" role="alert"></p><button class="primary" type="submit">Ingresar</button><p class="muted">Acceso privado de Therapy. Si olvidaste tu contraseña, solicitá al administrador que la restablezca en Supabase.</p></form>';
    panel.querySelector('.login-message').textContent=message;
    panel.addEventListener('cancel',e=>e.preventDefault());document.body.append(panel);panel.showModal();
    panel.querySelector('form').onsubmit=async e=>{
      e.preventDefault();const form=e.currentTarget,button=form.querySelector('button');button.disabled=true;
      try{
        const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.querySelector('[name=email]').value,password:form.querySelector('[name=password]').value})});
        const result=await r.json();if(!r.ok)throw Error(result.error||'No se pudo ingresar.');
        form.querySelector('[name=password]').value='';panel.close();panel.remove();pendingLogin=null;resolve();
      }catch(error){panel.querySelector('.login-error').textContent=error.message}finally{button.disabled=false}
    };
  });
  return pendingLogin;
}
window.therapyLogin=login;
try{
 const response=await fetch('/api/session');
 if(response.status===401)await login();
}catch{
 document.querySelector('#connection').textContent='No se pudo conectar. Recargá la página para reintentar.';
}
document.querySelector('#logout').onclick=async()=>{
  const r=await fetch('/api/logout',{method:'POST'});
  if(r.ok)location.reload();else alert('No se pudo cerrar la sesión. Reintentá.');
};
await import('./app.js');
