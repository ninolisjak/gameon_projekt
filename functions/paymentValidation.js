const ALLOWED_ENTITY_TYPES = ['match', 'reservation'];

const MIN_AMOUNT_EUR = 0.5;
const MAX_AMOUNT_EUR = 500;

const MAX_DESCRIPTION_LENGTH = 200;

function validatePaymentRequest(data, authUid) {
  if (!authUid) {
    return { ok: false, code: 'unauthenticated', message: 'Prijava je obvezna.' };
  }

  const body = data || {};
  const amount = Number(body.amount);

  if (!Number.isFinite(amount)) {
    return { ok: false, code: 'invalid-argument', message: 'Znesek ni stevilo.' };
  }
  if (amount < MIN_AMOUNT_EUR || amount > MAX_AMOUNT_EUR) {
    return {
      ok: false,
      code: 'invalid-argument',
      message: `Znesek mora biti med ${MIN_AMOUNT_EUR} in ${MAX_AMOUNT_EUR} EUR.`,
    };
  }

  if (!ALLOWED_ENTITY_TYPES.includes(body.entityType)) {
    return { ok: false, code: 'invalid-argument', message: 'Neveljaven tip placila.' };
  }

  if (typeof body.entityId !== 'string' || body.entityId.length === 0 || body.entityId.length > 128) {
    return { ok: false, code: 'invalid-argument', message: 'Neveljaven ID.' };
  }

  const description = typeof body.description === 'string'
    ? body.description.slice(0, MAX_DESCRIPTION_LENGTH)
    : '';

  return {
    ok: true,
    value: {
      userId: authUid,
      amount,
      amountInCents: Math.round(amount * 100),
      entityType: body.entityType,
      entityId: body.entityId,
      description,
    },
  };
}

module.exports = {
  validatePaymentRequest,
  ALLOWED_ENTITY_TYPES,
  MIN_AMOUNT_EUR,
  MAX_AMOUNT_EUR,
};
