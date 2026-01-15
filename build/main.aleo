program priv_messenger_leotest_007.aleo;

record Message:
    owner as address.public;
    sender as address.private;
    recipient as address.private;
    content as field.private;

struct ProfileInfo:
    name as field;
    bio as field;

struct MessageMeta:
    sender as address;
    content_hash as field;
    timestamp as u64;

mapping profiles:
    key as address.public;
    value as ProfileInfo.public;

mapping message_count:
    key as address.public;
    value as u64.public;

mapping message_index:
    key as field.public;
    value as MessageMeta.public;

function create_profile:
    input r0 as field.public;
    input r1 as field.public;
    async create_profile self.caller r0 r1 into r2;
    output r2 as priv_messenger_leotest_007.aleo/create_profile.future;

finalize create_profile:
    input r0 as address.public;
    input r1 as field.public;
    input r2 as field.public;
    cast r1 r2 into r3 as ProfileInfo;
    set r3 into profiles[r0];

function send_message:
    input r0 as address.public;
    input r1 as field.private;
    cast r0 self.caller r0 r1 into r2 as Message.record;
    cast self.caller self.caller r0 r1 into r3 as Message.record;
    hash.bhp256 r1 into r4 as field;
    async send_message r0 self.caller r4 into r5;
    output r2 as Message.record;
    output r3 as Message.record;
    output r5 as priv_messenger_leotest_007.aleo/send_message.future;

finalize send_message:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as field.public;
    get.or_use message_count[r0] 0u64 into r3;
    hash.bhp256 r0 into r4 as field;
    cast r3 into r5 as field;
    add r4 r5 into r6;
    cast block.height into r7 as u64;
    cast r1 r2 r7 into r8 as MessageMeta;
    set r8 into message_index[r6];
    add r3 1u64 into r9;
    set r9 into message_count[r0];

function update_profile:
    input r0 as field.public;
    input r1 as field.public;
    async update_profile self.caller r0 r1 into r2;
    output r2 as priv_messenger_leotest_007.aleo/update_profile.future;

finalize update_profile:
    input r0 as address.public;
    input r1 as field.public;
    input r2 as field.public;
    cast r1 r2 into r3 as ProfileInfo;
    set r3 into profiles[r0];

constructor:
    assert.eq edition 0u16;
