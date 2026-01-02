export const AL_PROGRAM_ID = "priv_mess_v4_1231.aleo";

export const AL_PROGRAM_SOURCE = `program priv_mess_v4_1231.aleo;

record Message:
    owner as address.public;
    sender as address.private;
    recipient as address.private;
    content as field.private;

struct ProfileInfo:
    name as field;
    bio as field;

mapping profiles:
    key as address.public;
    value as ProfileInfo.public;

mapping message_count:
    key as address.public;
    value as u64.public;

function create_profile:
    input r0 as field.public;
    input r1 as field.public;
    async create_profile self.caller r0 r1 into r2;
    output r2 as priv_mess_v4_1231.aleo/create_profile.future;

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
    async send_message r0 into r4;
    output r2 as Message.record;
    output r3 as Message.record;
    output r4 as priv_mess_v4_1231.aleo/send_message.future;

finalize send_message:
    input r0 as address.public;
    get.or_use message_count[r0] 0u64 into r1;
    add r1 1u64 into r2;
    set r2 into message_count[r0];

function update_profile:
    input r0 as field.public;
    input r1 as field.public;
    async update_profile self.caller r0 r1 into r2;
    output r2 as priv_mess_v4_1231.aleo/update_profile.future;

finalize update_profile:
    input r0 as address.public;
    input r1 as field.public;
    input r2 as field.public;
    cast r1 r2 into r3 as ProfileInfo;
    set r3 into profiles[r0];

constructor:
    assert.eq edition 0u16;
`;
