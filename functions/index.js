const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Stripe = require('stripe');

admin.initializeApp();

const stripe = new Stripe(process.env.STRIPE_SECRET);

const SUCCESS_BASE = 'https://gameon-9d876.firebaseapp.com/payment-success';
const CANCEL_URL   = 'https://gameon-9d876.firebaseapp.com/payment-cancel';

exports.createCheckoutSession = functions
  .region('europe-west1')
  .https.onCall(async (data) => {
    const { amount, entityType, entityId, userId, description } = data;

    if (!amount || amount <= 0) throw new functions.https.HttpsError('invalid-argument', 'Neveljaven znesek.');
    if (!entityType || !entityId || !userId) throw new functions.https.HttpsError('invalid-argument', 'Manjkajoči parametri.');

    const successUrl = `${SUCCESS_BASE}?type=${entityType}&id=${encodeURIComponent(entityId)}&userId=${encodeURIComponent(userId)}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: description || 'Najem igrišča — GameOn' },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: CANCEL_URL,
      metadata: { entityType, entityId, userId },
    });

    return { url: session.url };
  });

exports.createPaymentIntent = functions
  .region('europe-west1')
  .https.onCall(async (data) => {
    const { amount, entityType, entityId, userId, description } = data;

    if (!amount || amount <= 0) throw new functions.https.HttpsError('invalid-argument', 'Neveljaven znesek.');

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      description: description || 'GameOn — najem igrišča',
      metadata: { entityType, entityId, userId },
    });

    return { clientSecret: paymentIntent.client_secret };
  });
