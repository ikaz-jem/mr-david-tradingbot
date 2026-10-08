import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paymentCoinIcon, shouldVerifyPayment } from '../src/lib/payment-display.ts';
test('coin icons allow only official SVG paths and fall back safely', () => {
 assert.equal(paymentCoinIcon('USDTBSC', '/images/coins/usdt.svg'), 'https://nowpayments.io/images/coins/usdt.svg');
 for(const url of ['https://evil.example/coin.svg', 'javascript:alert(1)', 'https://nowpayments.io/other.svg', '//evil.example/logo.svg']) assert.equal(paymentCoinIcon('btc', url), 'https://nowpayments.io/images/coins/btc.svg');
 assert.equal(paymentCoinIcon('../x'), '');
});
test('automatic checks stop for terminal, demo and mismatched payments', () => {
 for(const status of ['pending','initializing']) assert.equal(shouldVerifyPayment({mode:'live',status}),true);
 assert.equal(shouldVerifyPayment({mode:'live',status:'review',providerStatus:'partially_paid'}),true);
 for(const status of ['paid','failed','review']) assert.equal(shouldVerifyPayment({mode:'live',status}),false);
 assert.equal(shouldVerifyPayment({mode:'demo',status:'pending'}),false);
});
