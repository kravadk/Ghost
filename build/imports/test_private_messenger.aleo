import private_messenger_leonid_1230.aleo;
program test_private_messenger.aleo;

function main:

function test_send_message:
    call private_messenger_leonid_1230.aleo/send_message aleo1yu6ssnehj4plgznatenfut3hkrfus26kqd226k99wfx79jqmsuxqfernns 123456789field into r0;
    assert.eq r0.owner aleo1yu6ssnehj4plgznatenfut3hkrfus26kqd226k99wfx79jqmsuxqfernns;
    assert.eq r0.content 123456789field;

function test_create_profile:
    call private_messenger_leonid_1230.aleo/create_profile 111field 222field into r0;
    async test_create_profile r0 into r1;
    output r1 as test_private_messenger.aleo/test_create_profile.future;

finalize test_create_profile:
    input r0 as private_messenger_leonid_1230.aleo/create_profile.future;
    await r0;

constructor:
    assert.eq edition 0u16;
