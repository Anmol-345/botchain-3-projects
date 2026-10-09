// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title AskaS - Creator content platform with time-based paid access on BOT Chain
/// @notice Creators publish paid posts; users pay BOT for time-limited access.
contract AskaS {
    struct Post {
        address creator;
        string title;
        string preview;
        uint256 price;      // in wei (BOT)
        uint64 duration;    // access duration in seconds
        uint64 createdAt;
        bool active;
    }

    uint256 public postCount;
    mapping(uint256 => Post) public posts;
    mapping(uint256 => string) private _content;
    // postId => user => access expiry timestamp
    mapping(uint256 => mapping(address => uint64)) public accessExpiry;

    event PostCreated(uint256 indexed postId, address indexed creator, uint256 price, uint64 duration);
    event PostUpdated(uint256 indexed postId, uint256 price, uint64 duration, bool active);
    event AccessGranted(uint256 indexed postId, address indexed user, uint64 expires);

    /// @notice Publish a new paid post. The content body is stored privately on-chain.
    function createPost(
        string calldata title,
        string calldata preview,
        string calldata body,
        uint256 price,
        uint64 duration
    ) external returns (uint256 postId) {
        require(bytes(title).length > 0, "Title required");
        require(duration > 0, "Duration required");
        postId = postCount++;
        posts[postId] = Post({
            creator: msg.sender,
            title: title,
            preview: preview,
            price: price,
            duration: duration,
            createdAt: uint64(block.timestamp),
            active: true
        });
        _content[postId] = body;
        emit PostCreated(postId, msg.sender, price, duration);
    }

    /// @notice Creator can update price, duration, active flag, title, preview and body.
    function updatePost(
        uint256 postId,
        string calldata title,
        string calldata preview,
        string calldata body,
        uint256 price,
        uint64 duration,
        bool active
    ) external {
        Post storage p = posts[postId];
        require(msg.sender == p.creator, "Not creator");
        require(duration > 0, "Duration required");
        p.title = title;
        p.preview = preview;
        p.price = price;
        p.duration = duration;
        p.active = active;
        _content[postId] = body;
        emit PostUpdated(postId, price, duration, active);
    }

    /// @notice Pay BOT to gain (or extend) access to a post.
    function purchaseAccess(uint256 postId) external payable {
        Post storage p = posts[postId];
        require(p.creator != address(0), "Post does not exist");
        require(p.active, "Post inactive");
        require(msg.value == p.price, "Incorrect payment amount");
        require(msg.sender != p.creator, "Creator has full access");

        uint64 base = accessExpiry[postId][msg.sender];
        if (base < block.timestamp) base = uint64(block.timestamp);
        uint64 expires = base + p.duration;
        accessExpiry[postId][msg.sender] = expires;

        (bool ok, ) = p.creator.call{value: msg.value}("");
        require(ok, "Creator payment failed");

        emit AccessGranted(postId, msg.sender, expires);
    }

    /// @notice Check whether a user currently has access to a post.
    function hasAccess(uint256 postId, address user) public view returns (bool) {
        if (posts[postId].creator == user) return true;
        return accessExpiry[postId][user] > block.timestamp;
    }

    /// @notice Returns the private content body. Only callers with valid access (or the creator) can read it.
    function getContent(uint256 postId) external view returns (string memory) {
        require(posts[postId].creator != address(0), "Post does not exist");
        require(hasAccess(postId, msg.sender), "No access");
        return _content[postId];
    }

    /// @notice Access expiry timestamp for a user (0 if never purchased).
    function accessExpiryOf(uint256 postId, address user) external view returns (uint64) {
        return accessExpiry[postId][user];
    }
}
