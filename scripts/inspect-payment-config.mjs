import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import mongoose from 'mongoose';
registerHooks({ resolve(s,c,next){ if(s.startsWith('@/')) return next(pathToFileURL(path.resolve('src', s.slice(2)+'.ts')).href,c); return next(s,c); } });
const {getGateway,publicGateway}=await import('../src/lib/payment-gateways.ts');
const {BillingPurchase}=await import('../src/models/BillingPurchase.ts');
try {
 for(const demo of [false,true]) for(const provider of ['nowpayments','paystack']) {
  const g=await getGateway(provider,demo);
  console.log(JSON.stringify(publicGateway(g)));
  if(g.key && g.mode!=='demo') {
   const base=provider==='paystack'?'https://api.paystack.co/':g.mode==='test'?'https://api-sandbox.nowpayments.io/v1/':'https://api.nowpayments.io/v1/';
   for(const endpoint of provider==='paystack'?['balance']:['currencies','merchant/coins','full-currencies']) {
    const r=await fetch(base+endpoint,{headers:provider==='paystack'?{Authorization:`Bearer ${g.key}`}:{'x-api-key':g.key},signal:AbortSignal.timeout(15000)});
    const body=await r.json().catch(()=>({}));
    console.log(JSON.stringify({demo,provider,endpoint,status:r.status,fields:Object.keys(body),code:body.code,error:r.ok?undefined:body.message,currencies:body.currencies?.slice(0,2),selectedCurrencies:body.selectedCurrencies}));
   }
  }
 }
 console.log(JSON.stringify(await BillingPurchase.find({status:{$in:['review','initializing']}}).sort({createdAt:-1}).limit(8).select('provider mode isDemo status createdAt').lean()));
} finally {await mongoose.disconnect();}
