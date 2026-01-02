// The 'test_private_messenger' test program.
import private_messenger_leonid_1231.aleo;

program test_private_messenger.aleo {
    
    // Dummy transition to satisfy compiler requirement
    transition main() {}

    @noupgrade
    async constructor() {}

    @test
    transition test_send_message() {
        let recipient: address = aleo1yu6ssnehj4plgznatenfut3hkrfus26kqd226k99wfx79jqmsuxqfernns;
        let content: field = 123456789field; // "Hello" encoded

        // Call the send_message transition
        let msg: private_messenger_leonid_1231.aleo/Message = private_messenger_leonid_1231.aleo/send_message(recipient, content);

        // Verify the output record
        assert_eq(msg.owner, recipient);
        assert_eq(msg.content, content);
    }

    @test
    async transition test_create_profile() -> Future {
        let name: field = 111field; // "Alice"
        let bio: field = 222field;  // "Bio"
        
        // Just verify it runs without error
        let f: Future = private_messenger_leonid_1231.aleo/create_profile(name, bio);
        return finalize_test_create_profile(f);
    }

    async function finalize_test_create_profile(f: Future) {
        f.await();
    }
}
