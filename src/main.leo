program priv_messenger_leotest_007.aleo {
    // This is the constructor for the program.
    // It is called when the program is deployed.
    @noupgrade
    async constructor() {}

    struct ProfileInfo {
        name: field,
        bio: field,
    }

    // Struct to store message metadata for indexing
    struct MessageMeta {
        sender: address,
        content_hash: field,
        timestamp: u64,
    }

    // Profiles mapping
    mapping profiles: address => ProfileInfo;

    // Count of messages per recipient
    mapping message_count: address => u64;

    // Message index: key = hash(recipient, index) => MessageMeta
    // This allows us to find all messages for a recipient by iterating 0..message_count
    mapping message_index: field => MessageMeta;

    // Message record (private)
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

    // Send message with indexing
    // recipient is public so we can index messages
    // sender_public is also public for easier discovery
    async transition send_message(
        public recipient: address, 
        private content: field
    ) -> (Message, Message, Future) {
        let sender: address = self.caller;
        
        // Create inbox message (owned by recipient)
        let inbox_msg: Message = Message {
            owner: recipient,
            sender: sender,
            recipient: recipient,
            content: content,
        };

        // Create sent message (owned by sender)
        let sent_msg: Message = Message {
            owner: sender,
            sender: sender,
            recipient: recipient,
            content: content,
        };

        // Pass sender and content hash to finalize for indexing
        return (inbox_msg, sent_msg, finalize_send_message(recipient, sender, BHP256::hash_to_field(content)));
    }

    async function finalize_send_message(recipient: address, sender: address, content_hash: field) {
        // Get current message count for recipient
        let current_count: u64 = Mapping::get_or_use(message_count, recipient, 0u64);
        
        // Create index key: hash(recipient address as field + message index)
        // This creates a unique key for each message
        let recipient_field: field = BHP256::hash_to_field(recipient);
        let index_key: field = recipient_field + (current_count as field);
        
        // Store message metadata
        let meta: MessageMeta = MessageMeta {
            sender: sender,
            content_hash: content_hash,
            timestamp: block.height as u64,  // Use block height as timestamp
        };
        Mapping::set(message_index, index_key, meta);
        
        // Increment message count
        Mapping::set(message_count, recipient, current_count + 1u64);
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
}
