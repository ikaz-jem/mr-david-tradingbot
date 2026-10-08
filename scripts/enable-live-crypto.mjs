import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import mongoose from 'mongoose';
registerHooks({ resolve(s,c,next){ if(s.startsWith('@/')) return next(pathToFileURL(path.resolve('src', s.slice(2)+'.ts')).href,c); return next(s,c); } });
if (!process.argv.includes('--confirm-live') && process.env.PAYMENT_CONFIRM_LIVE !== 'true') throw new Error('Requires --confirm-live and owner authorization');
const {getGateway}=await import('../src/lib/payment-gateways.ts');
const {cryptoPaymentCurrencies}=await import('../src/lib/crypto-payment-currencies.ts');
const {PaymentGateway}=await import('../src/models/PaymentGateway.ts');
const {User}=await import('../src/models/User.ts');
const {AdminAuditEvent}=await import('../src/models/AdminAuditEvent.ts');
try {
 const gateway=await getGateway('nowpayments',false);
 if(!gateway.key || !gateway.webhookSecret || gateway.mode!=='live') throw new Error('Live credentials missing');
 const coins=await cryptoPaymentCurrencies(gateway,true);
 if(!coins.length) throw new Error('No merchant currencies available');
 const callback=new URL('/api/webhooks/nowpayments',process.env.APP_URL);
 if(callback.protocol!=='https:') throw new Error('Public HTTPS callback required');
 const response=await fetch(callback,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
 if(!response.ok || !(await response.json()).ignored) throw new Error('Callback not reachable');
 const previous=await PaymentGateway.findById(gateway.id).select('+apiKeyEncrypted +webhookSecretEncrypted').lean();
 const owner=await User.findOne({email:'echchebabzakariae@gmail.com',role:'admin',isDemo:false,status:'active'}).select('_id').lean();
 if(!previous || !owner) throw new Error('Owner or config missing');
 await mongoose.connection.transaction(async session=>{
  const [record]=await PaymentGateway.create([{provider:'nowpayments',isDemo:false,enabled:true,mode:'live',currency:'USD',ratePerUsd:1,apiKeyEncrypted:previous.apiKeyEncrypted,webhookSecretEncrypted:previous.webhookSecretEncrypted,createdBy:owner._id}],{session});
  await AdminAuditEvent.create([{actorId:owner._id,targetType:'platform',targetId:String(record._id),action:'payment_gateway_configuration',before:JSON.stringify({enabled:previous.enabled}),after:JSON.stringify({enabled:true,mode:'live'}),reason:'Owner explicitly requested live crypto checkout; API and callback connectivity checked. No customer payment made.',status:'applied'}],{session});
  const [demo]=await PaymentGateway.create([{provider:'nowpayments',isDemo:true,enabled:true,mode:'demo',currency:'USD',ratePerUsd:1,createdBy:owner._id}],{session});
  await AdminAuditEvent.create([{actorId:owner._id,targetType:'platform',targetId:String(demo._id),action:'payment_gateway_configuration',before:JSON.stringify({scope:'demo'}),after:JSON.stringify({mode:'demo',credentialsCleared:true}),reason:'Restore isolated demo simulation; live key was incorrectly used against the sandbox endpoint.',status:'applied'}],{session});
 });
 console.log(JSON.stringify({liveCryptoEnabled:true,availableMerchantCurrencies:coins.length,demoRestored:true,callback:String(callback),paymentCreated:false}));
} finally {await mongoose.disconnect();}
