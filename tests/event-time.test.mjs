import test from 'node:test';
import assert from 'node:assert/strict';
import {settings} from '../shared/catalog.mjs';
import {pickupTimes,requestDateAvailable,requestTimeAllowed,nextRequestDate,eventTimeMinimum} from '../shared/schedule.mjs';
test('event requests accept an explicit requested time independently of takeaway slots',()=>{
 const now=new Date('2026-10-23T06:00:00Z');
 assert.equal(requestTimeAllowed(settings,'2026-10-23','14:15','event',now),true);
 assert.equal(requestTimeAllowed(settings,'2026-10-23','14:15','takeaway',now),false);
 assert.deepEqual(pickupTimes(settings,'2026-10-24',now),[]);
 assert.equal(requestDateAvailable(settings,'2026-10-24','event',now),true);
 assert.equal(requestTimeAllowed(settings,'2026-10-24','14:15','event',now),true);
 assert.equal(requestTimeAllowed(settings,'2026-10-23','08:30','event',now),false);
 for(const time of ['','25:00','14:99','9:00'])assert.equal(requestTimeAllowed(settings,'2026-10-24',time,'event',now),false);
 assert.equal(requestTimeAllowed({...settings,blockedDates:['2026-10-24']},'2026-10-24','14:15','event',now),false);
 assert.equal(requestTimeAllowed(settings,'2026-02-30','14:15','event',now),false);
 assert.equal(nextRequestDate(settings,'event',new Date('2026-10-23T18:00:00Z')),'2026-10-23');
 assert.equal(nextRequestDate(settings,'takeaway',new Date('2026-10-23T18:00:00Z')),'2026-10-25');
 assert.equal(eventTimeMinimum('2026-10-23',now),'09:01');
});
