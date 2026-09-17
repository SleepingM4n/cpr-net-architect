import test from "node:test";
import assert from "node:assert/strict";
import { SessionService } from "../scripts/services/session-service.js";
import { makeArchitecture, makeNode } from "../scripts/services/import-export-service.js";
import { getVisibleSessionStateForUser } from "../scripts/services/permission-service.js";
import { ensureRunners, syncRunner } from "../scripts/services/runner-state.js";

async function fixture() {
  const gm = { id: "gm", isGM: true, active: true };
  const players = Array.from({length: 7}, (_, i) => ({ id: `p${i}`, isGM: false, active: true }));
  const users = [gm, ...players]; users.get = id => users.find(u => u.id === id); users.has = id => !!users.get(id);
  const actors = players.map((u, i) => ({ uuid: `Actor.a${i}`, name: `Runner ${i}`, valid: true,
    testUserPermission: user => user.id === u.id, items: new Map(),
    system: { derivedStats: { hp: { value: 40 } } }, getFlag: () => [],
    update: async function(changes) { this.changes = changes; }
  }));
  globalThis.game = { user: gm, users, combat: null, messages: new Map(), settings: { get: (_, k) => ({ allowObservers: true, chatLevel: "none" })[k] } };
  globalThis.canvas = { tokens: { controlled: [] } };
  globalThis.Hooks = { callAll() {} };
  globalThis.fromUuid = async uuid => actors.find(a => a.uuid === uuid);
  const a = makeArchitecture("Shared Datafort");
  for (let i=0;i<2;i++) { const n=makeNode("password"); n.name=`Secret ${i}`; n.gmNotes="GM SECRET"; n.challenge.requireApproval=false; a.nodes.push(n); a.edges.push({id:`e${i}`,from:a.entryNodeId,to:n.id}); }
  let saved; const deliveries=[];
  const store={ get:()=>structuredClone(a), saveSession:async s=>{saved=structuredClone(s);}, refresh:async()=>{}, loadSession:()=>structuredClone(saved), saveLog:async()=>{} };
  const adapter={ resolve:fromUuid, qualifies:a=>a.valid, isIce:()=>false,
    profile:a=>({name:a.name,uuid:a.uuid,rank:4,deckId:`deck-${a.uuid}`,decks:[],programs:[],img:"",hp:40}),
    shareRevealedRoll:async()=>{}, encounterRoll:async (_ice,_op,_program,actor)=>({total:actor.uuid===actors[1].uuid?9:1}) };
  const socket={state:async(u,s)=>deliveries.push({id:u.id,state:s})};
  const service=new SessionService(store,adapter,socket,{});
  await service.start(a.id,actors[0].uuid,{userId:players[0].id,actions:3});
  const send=(user,action,extra={})=>service.request(user,{sessionId:service.session.id,revision:service.session.revision,action,...extra});
  const add=i=>send(gm,"addRunner",{actorUuid:actors[i].uuid,userId:players[i].id});
  return {service,gm,players,actors,a,store,adapter,socket,send,add,deliveries};
}

test("six unique owned qualified runners allowed; seventh, duplicate, unowned and unqualified actors rejected",async()=>{
 const f=await fixture();
 await assert.rejects(f.send(f.gm,"addRunner",{actorUuid:f.actors[1].uuid,userId:f.players[2].id}),/own/);
 f.actors[1].valid=false; await assert.rejects(f.add(1),/NET Role/); f.actors[1].valid=true;
 await f.add(1); await assert.rejects(f.add(1),/already/);
 await assert.rejects(f.send(f.players[1],"addRunner",{actorUuid:f.actors[2].uuid,userId:f.players[2].id}),/GM only/);
 for(let i=2;i<6;i++) await f.add(i);
 assert.equal(Object.keys(f.service.session.runners).length,6);
 await assert.rejects(f.add(6),/six/);
});

test("players Jack In and move independently; forged runner IDs cannot control someone else",async()=>{
 const f=await fixture(); await f.add(1);
 await f.send(f.players[0],"jackIn");
 assert.equal(f.service.session.runners.p1.status,"login");
 await f.send(f.players[1],"jackIn");
 await f.send(f.gm,"bypass",{nodeId:f.a.nodes[1].id});
 await f.send(f.players[1],"move",{nodeId:f.a.nodes[1].id,runnerId:"p0"});
 const s=f.service.session;
 assert.equal(s.runners.p0.currentNodeId,f.a.entryNodeId);
 assert.equal(s.runners.p1.currentNodeId,f.a.nodes[1].id);
 const p0=await f.service.projection(f.players[0]),p1=await f.service.projection(f.players[1]);
 assert.equal(p0.runner.profile.name,"Runner 0"); assert.equal(p1.runner.profile.name,"Runner 1");
 assert.ok(!JSON.stringify(p0).includes("Secret 0")); assert.ok(JSON.stringify(p1).includes("Secret 0"));
 assert.ok(!JSON.stringify(p1).includes("GM SECRET")); assert.equal(p0.runners,undefined);
 assert.equal(p0.playerRunners.find(r=>r.userId==="p1").nodeId,null);
 await f.send(f.players[1],"end");
 assert.equal(s.runners.p0.status,"active");assert.equal(s.runners.p1.status,"login");assert.equal(s.runners.p1.currentNodeId,f.a.entryNodeId);
 await f.send(f.players[1],"jackIn"); assert.equal(s.runners.p1.status,"active");
});

test("concurrent roll grants remain bound to each player and separate action budgets",async()=>{
 const f=await fixture();await f.add(1);
 for(const p of f.players.slice(0,2)) await f.send(p,"jackIn");
 const r0=await f.send(f.players[0],"attempt",{nodeId:f.a.nodes[1].id});
 const r1=await f.send(f.players[1],"attempt",{nodeId:f.a.nodes[2].id});
 assert.notEqual(r0.rollGrant.token,r1.rollGrant.token);
 await assert.rejects(f.send(f.players[1],"cancelRoll",{token:r0.rollGrant.token}),/matching/);
 for(let i=0;i<2;i++) {
  const grant=[r0,r1][i].rollGrant;
  game.messages.set(`m${i}`,{author:f.players[i],getFlag:()=>({token:grant.token,actorUuid:f.actors[i].uuid,total:99})});
  await f.send(f.players[i],"completeRoll",{token:grant.token,messageId:`m${i}`});
 }
 assert.equal(f.service.session.runners.p0.actions.used,1);assert.equal(f.service.session.runners.p1.actions.used,1);
 assert.equal(f.service.pendingRolls.size,0);
});

test("GM selection, reload and reset preserve each runner without sharing inventory",async()=>{
 const f=await fixture();await f.add(1);await f.send(f.players[1],"jackIn");
 await f.send(f.gm,"selectRunner",{runnerId:"p1"});
 assert.equal((await f.service.projection(f.gm)).runner.userId,"p1");
 await f.send(f.gm,"budget",{runnerId:"p1",max:5});
 assert.equal(f.service.session.runners.p0.actions.max,3);
 const restored=new SessionService(f.store,f.adapter,f.socket,{});await restored.restore();
 assert.equal(restored.session.runners.p1.actions.max,5);
 assert.equal((await restored.projection(f.players[1])).status,"active");
 await f.send(f.gm,"reset",{runnerId:"p1"});
 for(const r of Object.values(f.service.session.runners)) {assert.equal(r.status,"login");assert.deepEqual(r.discoveredNodeIds,[]);assert.equal(r.actions.used,0);}
 const legacy=structuredClone(f.service.session);delete legacy.runners;ensureRunners(legacy);
 assert.equal(Object.keys(legacy.runners).length,1);
});

test("ICE attacks and confirmed damage use the bound target after the GM switches runners",async()=>{
 const f=await fixture();await f.add(1);for(const p of f.players.slice(0,2))await f.send(p,"jackIn");
 f.service.session.iceStates.ice={name:"Hellhound",nodeId:f.a.entryNodeId,rezzed:true,visible:true,rez:{value:10,max:10},stats:{},programs:[]};
 await f.send(f.gm,"iceTarget",{runnerId:"p1",iceId:"ice"});
 assert.equal(f.service.session.iceStates.ice.target.runnerId,"p1");
 await f.send(f.gm,"encounterRoll",{runnerId:"p0",iceId:"ice",operation:"damage"});
 const entry=f.service.session.netCombat.at(-1);assert.equal(entry.total,9);
 await f.send(f.gm,"applyNetDamage",{runnerId:"p0",rollId:entry.id,amount:9});
 assert.equal(f.actors[1].changes["system.derivedStats.hp.value"],31);assert.equal(f.actors[0].changes,undefined);
 await assert.rejects(f.send(f.gm,"applyNetDamage",{rollId:entry.id,amount:9}),/unapplied/);
});

test("moving one runner preserves ICE targeting another runner; GM end closes all clients",async()=>{
 const f=await fixture();await f.add(1);for(const p of f.players.slice(0,2))await f.send(p,"jackIn");
 const s=f.service.session;s.iceStates.ice={nodeId:f.a.entryNodeId,rezzed:true,target:{kind:"runner",runnerId:"p0",name:"Runner 0"}};
 await f.send(f.gm,"bypass",{nodeId:f.a.nodes[1].id});await f.send(f.players[1],"move",{nodeId:f.a.nodes[1].id});
 assert.equal(s.iceStates.ice.target.runnerId,"p0");
 await f.send(f.gm,"end");assert.equal(f.service.session,null);
 for(const p of f.players.slice(0,2))assert.equal(f.deliveries.filter(d=>d.id===p.id).at(-1).state,null);
});
