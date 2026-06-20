(async function(){
  const url = 'http://localhost:8000/api/v1/auth/login'
  const headers = {
    'Origin':'https://localhost:5173',
    'Access-Control-Request-Method':'POST',
    'Access-Control-Request-Headers':'content-type,authorization,x-tenant-id'
  }
  try{
    const res = await fetch(url, { method: 'OPTIONS', headers })
    console.log('status:', res.status)
    for(const [k,v] of res.headers){
      const key = k.toLowerCase()
      if(key.startsWith('access-control') || key.startsWith('allow')){
        console.log(k+':', v)
      }
    }
    const text = await res.text()
    console.log('\nbody:\n', text)
  }catch(e){
    console.error('error', e)
  }
})()
