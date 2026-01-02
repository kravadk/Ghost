program priv_mess_v4_1231.aleo {
    struct ProfileInfo {
        name: field,
        bio: field,
    }

    mapping profiles: address => ProfileInfo;

    mapping message_count: address => u64;

    record Message {
        public owner: address,
        sender: address,
        recipient: address,
        content: field,
    }

    async transition create_profile(public name: field, public bio: field) -> Future {
        return finalize_create_profile(self.caller, name, bio);
    }

    async function finalize_create_profile(user: address, name: field, bio: field) {
        let info: ProfileInfo = ProfileInfo {
            name: name,
            bio: bio
        };
        Mapping::set(profiles, user, info);
    }

    async transition send_message(public recipient: address, private content: field) -> (Message, Message, Future) {
        let sender: address = self.caller;
        let inbox_msg: Message = Message {
            owner: recipient,
            sender: sender,
            recipient: recipient,
            content: content,
        };

        let sent_msg: Message = Message {
            owner: sender,
            sender: sender,
            recipient: recipient,
            content: content,
        };

        return (inbox_msg, sent_msg, finalize_send_message(recipient));
    }

    async function finalize_send_message(recipient: address) {
        let current: u64 = Mapping::get_or_use(message_count, recipient, 0u64);
        Mapping::set(message_count, recipient, current + 1u64);
    }

    async transition update_profile(public name: field, public bio: field) -> Future {
        return finalize_update_profile(self.caller, name, bio);
    }

    async function finalize_update_profile(user: address, name: field, bio: field) {
        let info: ProfileInfo = ProfileInfo {
            name: name,
            bio: bio
        };
        Mapping::set(profiles, user, info);
    }

    @noupgrade
    async constructor() {
    }
}
