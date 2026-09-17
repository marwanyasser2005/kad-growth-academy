import test from "node:test";
import assert from "node:assert/strict";
import {hashPassword,verifyPassword,validPassword,sha256,parseCookies,safeText,rateLimit} from "../backend/security.mjs";

test("team passwords use salted scrypt hashes and constant-shape verification",()=>{
 const first=hashPassword("Strong-password-27!"),second=hashPassword("Strong-password-27!");
 assert.match(first,/^scrypt\$32768\$8\$1\$/);assert.notEqual(first,second);
 assert(verifyPassword("Strong-password-27!",first));assert(!verifyPassword("wrong-password",first));
});

test("team password policy requires length, a number and symbol",()=>{
 assert(validPassword("Strong-password-27!"));assert(!validPassword("short!2"));assert(!validPassword("longpasswordwithoutnumber!"));assert(!validPassword("LongPasswordWithoutSymbol27"));
});

test("session helpers hash tokens, parse strict cookies and bound text",()=>{
 assert.equal(sha256("token"),sha256("token"));assert.notEqual(sha256("token"),sha256("other"));
 assert.deepEqual(parseCookies("a=1; kad_session=abc%20123"),{a:"1",kad_session:"abc 123"});
 assert.equal(safeText("  content  ",20),"content");assert.equal(safeText("x".repeat(30),10).length,10);
});

test("login limiter rejects attempts above its configured window",()=>{
 const key=`test-${Date.now()}`;assert(rateLimit(key,{limit:2,windowMs:60000}));assert(rateLimit(key,{limit:2,windowMs:60000}));assert(!rateLimit(key,{limit:2,windowMs:60000}));
});

