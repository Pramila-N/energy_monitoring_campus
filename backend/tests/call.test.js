import { test } from 'node:test';
import assert from 'node:assert/strict';
import voiceService from '../services/voiceService.js';
import rateLimitCalls from '../middleware/rateLimit.js';

const {
  normalizeIndianMobile,
  isValidIndianMobile,
  maskPhoneNumber,
  mapExotelStatus,
  isTerminalStatus,
  hasActiveCall,
  buildIvRXml
} = voiceService;

test('normalizeIndianMobile — accepts common Indian formats', () => {
  assert.equal(normalizeIndianMobile('+91 98450 11001'), '+919845011001');
  assert.equal(normalizeIndianMobile('+919845011001'), '+919845011001');
  assert.equal(normalizeIndianMobile('919845011001'), '+919845011001');
  assert.equal(normalizeIndianMobile('9845011001'), '+919845011001');
  assert.equal(normalizeIndianMobile('09845011001'), '+919845011001');
  assert.equal(normalizeIndianMobile('+91-98450-11001'), '+919845011001');
  assert.equal(normalizeIndianMobile('+918001234567'), '+918001234567'); // 8-series valid
});

test('normalizeIndianMobile — rejects invalid numbers', () => {
  assert.equal(normalizeIndianMobile(''), null);
  assert.equal(normalizeIndianMobile(null), null);
  assert.equal(normalizeIndianMobile('12345'), null);          // too short
  assert.equal(normalizeIndianMobile('98450110011'), null);    // too long (11 digits)
  assert.equal(normalizeIndianMobile('5845011001'), null);     // invalid 8-series start
  assert.equal(normalizeIndianMobile('+1 9845011001'), null);  // not an Indian prefix
  assert.equal(normalizeIndianMobile('984501100'), null);      // 9 digits
});

test('isValidIndianMobile mirrors normalizer', () => {
  assert.equal(isValidIndianMobile('+91 98450 11001'), true);
  assert.equal(isValidIndianMobile('not-a-number'), false);
});

test('maskPhoneNumber never leaks the full number', () => {
  const m = maskPhoneNumber('9845011001');
  assert.ok(m.includes('+91'));
  assert.ok(m.includes('01'));
  assert.ok(!m.includes('8450110')); // middle digits hidden
});

test('mapExotelStatus maps provider statuses to CallLog enum', () => {
  assert.equal(mapExotelStatus('queued'), 'initiated');
  assert.equal(mapExotelStatus('ringing'), 'ringing');
  assert.equal(mapExotelStatus('in-progress'), 'in-progress');
  assert.equal(mapExotelStatus('completed'), 'completed');
  assert.equal(mapExotelStatus('no-answer'), 'no-answer');
  assert.equal(mapExotelStatus('busy'), 'busy');
  assert.equal(mapExotelStatus('failed'), 'failed');
  assert.equal(mapExotelStatus('garbage'), null);
});

test('isTerminalStatus / hasActiveCall', () => {
  assert.equal(isTerminalStatus('completed'), true);
  assert.equal(isTerminalStatus('failed'), true);
  assert.equal(isTerminalStatus('ringing'), false);
  assert.equal(hasActiveCall([{ status: 'ringing' }]), true);
  assert.equal(hasActiveCall([{ status: 'completed' }]), false);
  assert.equal(hasActiveCall([]), false);
  assert.equal(hasActiveCall(null), false);
});

test('buildIvRXml — contains room + forecast message, XML-escaped', () => {
  const xml = buildIvRXml({ roomNumber: 'C-204', facultyName: 'Dr. A & B', predicted: 2.4, pct: 68 });
  assert.ok(xml.includes('C-204'));
  assert.ok(xml.includes('68'));
  assert.ok(xml.includes('&amp;'));
});

test('rate limiter allows <max calls then blocks', () => {
  const limiter = rateLimitCalls({ windowMs: 60000, max: 2 });
  const call = (n) => {
    let code = 200;
    const res = { status(c) { code = c; return this; }, json() {} };
    limiter({ admin: { _id: 'x' }, ip: 'ip' }, res, () => {});
    return code;
  };
  assert.equal(call(1), 200);
  assert.equal(call(2), 200);
  assert.equal(call(3), 429);
});