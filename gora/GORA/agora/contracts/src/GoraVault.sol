// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {IENSRegistry} from "./interfaces/IENSRegistry.sol";
import {IAddrResolver} from "./interfaces/IAddrResolver.sol";
import {INameWrapper} from "./interfaces/INameWrapper.sol";

/// @title  GoraVault
/// @notice A shared vault whose members are public — but not who acts.
///
///         The contract holds NO signer list. It queries ENS:
///           - the right to appoint = ownership of the parent name (NameWrapper.ownerOf)
///           - mandate duration     = expiry of the subname       (NameWrapper.getData)
///           - the signing address  = addr record of the subname  (ENS resolver)
///
///         Remove ENS and you must rewrite a hierarchical permission system
///         with expiration inside the contract.
///
/// @dev    Emergency withdrawal: if all active signers expire before executing
///         a transaction, the vault would be frozen. The parent-name owner
///         (the nominating authority) can call emergencyWithdraw() after a
///         EMERGENCY_DELAY has elapsed since it was queued. This preserves the
///         invariant that the nominating authority controls the vault while
///         providing a last-resort escape for funds.
contract GoraVault {
    // ——— ENS dependencies, immutable ————————————————————————

    IENSRegistry public immutable ENS;
    INameWrapper public immutable NAME_WRAPPER;

    /// @notice namehash("treasury.gora.eth"). Its ownership IS the right to appoint.
    bytes32 public immutable parentNode;

    /// @notice Number of valid signatures required.
    uint256 public immutable threshold;

    // ——— Emergency withdrawal ————————————————————————————————

    /// @notice Delay (in seconds) the parent-name owner must wait after queuing
    ///         an emergency withdrawal before it can be executed.
    ///         72 hours gives signers time to notice and act if the vault is not
    ///         actually frozen.
    uint256 public constant EMERGENCY_DELAY = 72 hours;

    /// @notice Timestamp when emergencyQueue() was called, 0 if not queued.
    uint256 public emergencyQueuedAt;

    event EmergencyQueued(address indexed by, uint256 executeAfter);
    event EmergencyWithdrawn(address indexed to, uint256 amount);
    event EmergencyCancelled(address indexed by);

    error EmergencyNotQueued();
    error EmergencyDelayNotElapsed(uint256 remaining);
    error EmergencyAlreadyQueued();

    // ——— state ———————————————————————————————————————————————

    uint256 public nonce;

    bytes32[] public seatNodes;
    mapping(bytes32 => bool) public isSeat;
    mapping(bytes32 => uint256) private _seatIndex; // node → index+1 in seatNodes

    // ——— EIP-712 ——————————————————————————————————————————————

    bytes32 private constant _DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant _EXECUTE_TYPEHASH =
        keccak256("Execute(address to,uint256 value,bytes32 dataHash,uint256 nonce)");

    // ——— events ———————————————————————————————————————————————

    /// @notice Emitted on appointment AND on each rotation (§5.7). A node may
    ///         carry multiple events: the detection scan must keep THE MOST
    ///         RECENT per node, otherwise the holder recomputes a stale key.
    ///
    ///         NO member name here — deliberately. The member list lives on the
    ///         parent name (text record gora-members): publishing the name in
    ///         the seat event would publicly link a member to an address, which
    ///         the entire project forbids (§2).
    event SeatAssigned(
        bytes32 indexed node,
        address indexed stealthAddress,
        bytes ephemeralPubKey, // R, 33 bytes compressed
        uint8 viewTag
    );
    event SeatRemoved(bytes32 indexed node);
    event Executed(bytes32 indexed digest, address to, uint256 value);

    // ——— errors ———————————————————————————————————————————————

    error NotNameOwner();
    error SeatExpired(bytes32 node);
    error NotASigner(address who);
    error DuplicateSigner(address who);
    error ThresholdNotMet(uint256 got, uint256 need);
    error BadNonce();
    error BadEphemeralKeyLength();
    error SeatHasNoAddrRecord();
    error UnknownSeat(bytes32 node);
    error CallFailed();

    // ——— construction ————————————————————————————————————————

    constructor(address ens_, address nameWrapper_, bytes32 parentNode_, uint256 threshold_) {
        require(ens_ != address(0) && nameWrapper_ != address(0), "zero dependency");
        require(threshold_ > 0, "threshold must be > 0");
        ENS = IENSRegistry(ens_);
        NAME_WRAPPER = INameWrapper(nameWrapper_);
        parentNode = parentNode_;
        threshold = threshold_;
    }

    receive() external payable {}

    // ——— appointment and rotation ————————————————————————————

    /// @notice Registers a seat, or rotates its address.
    ///
    ///         The ENS subname must already exist, be wrapped, not expired, and
    ///         its addr record must ALREADY point to the stealth address.
    ///         The contract verifies — it does not create.
    ///
    /// @dev    Called again on an already-registered node, this IS rotation (§5.7):
    ///         new ephemeral key, new event, no state to modify.
    ///         The old address stops being a signer as soon as the addr record
    ///         changes, because isActiveSigner resolves live.
    function assignSeat(bytes32 node, bytes calldata ephemeralPubKey, uint8 viewTag)
        external
        onlyParentOwner
    {
        if (ephemeralPubKey.length != 33) revert BadEphemeralKeyLength();

        (,, uint64 expiry) = NAME_WRAPPER.getData(uint256(node));
        if (expiry <= block.timestamp) revert SeatExpired(node);

        address a = _resolve(node);
        if (a == address(0)) revert SeatHasNoAddrRecord();

        if (!isSeat[node]) {
            isSeat[node] = true;
            seatNodes.push(node);
            _seatIndex[node] = seatNodes.length; // index + 1
        }

        emit SeatAssigned(node, a, ephemeralPubKey, viewTag);
    }

    /// @notice Early revocation. Does not touch ENS: only removes the seat from
    ///         the list the vault queries. Expiration needs no one.
    function removeSeat(bytes32 node) external onlyParentOwner {
        uint256 idx = _seatIndex[node];
        if (idx == 0) revert UnknownSeat(node);

        uint256 i = idx - 1;
        uint256 last = seatNodes.length - 1;
        if (i != last) {
            bytes32 moved = seatNodes[last];
            seatNodes[i] = moved;
            _seatIndex[moved] = i + 1;
        }
        seatNodes.pop();

        delete _seatIndex[node];
        delete isSeat[node];

        emit SeatRemoved(node);
    }

    /// @dev The right to appoint is not a list in this contract.
    ///      It is the ownership of an ENS name.
    modifier onlyParentOwner() {
        if (NAME_WRAPPER.ownerOf(uint256(parentNode)) != msg.sender) {
            revert NotNameOwner();
        }
        _;
    }

    // ——— emergency withdrawal ————————————————————————————————

    /// @notice Step 1: queue an emergency withdrawal. The parent-name owner
    ///         calls this to start the 72-hour timer. Intended for use when
    ///         all active signers have expired and normal execution is impossible.
    /// @dev    Anyone can verify the queue on-chain via emergencyQueuedAt.
    ///         Signers seeing this have 72 hours to sign and execute normally.
    function emergencyQueue() external onlyParentOwner {
        if (emergencyQueuedAt != 0) revert EmergencyAlreadyQueued();
        emergencyQueuedAt = block.timestamp;
        emit EmergencyQueued(msg.sender, block.timestamp + EMERGENCY_DELAY);
    }

    /// @notice Step 2: execute the emergency withdrawal after the delay.
    ///         Sends the entire vault balance to the parent-name owner.
    /// @dev    Cancels the queue after execution (idempotent guard).
    function emergencyWithdraw() external onlyParentOwner {
        if (emergencyQueuedAt == 0) revert EmergencyNotQueued();
        uint256 elapsed = block.timestamp - emergencyQueuedAt;
        if (elapsed < EMERGENCY_DELAY) {
            revert EmergencyDelayNotElapsed(EMERGENCY_DELAY - elapsed);
        }
        emergencyQueuedAt = 0;
        uint256 amount = address(this).balance;
        emit EmergencyWithdrawn(msg.sender, amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
    }

    /// @notice Cancel a queued emergency withdrawal (e.g. if signers recovered).
    function emergencyCancel() external onlyParentOwner {
        if (emergencyQueuedAt == 0) revert EmergencyNotQueued();
        emergencyQueuedAt = 0;
        emit EmergencyCancelled(msg.sender);
    }

    // ——— state reads ——————————————————————————————————————————

    /// @notice A seat is active if its name is not expired AND its addr record
    ///         resolves to a non-zero address.
    /// @dev    Resolution happens at read time, never cached.
    ///         This makes rotation instantaneous.
    function isActiveSigner(address who) public view returns (bool) {
        if (who == address(0)) return false;
        uint256 n = seatNodes.length;
        for (uint256 i; i < n; ++i) {
            bytes32 node = seatNodes[i];
            (,, uint64 expiry) = NAME_WRAPPER.getData(uint256(node));
            if (expiry <= block.timestamp) continue;
            if (_resolve(node) == who) return true;
        }
        return false;
    }

    function activeSignerCount() external view returns (uint256 count) {
        uint256 n = seatNodes.length;
        for (uint256 i; i < n; ++i) {
            bytes32 node = seatNodes[i];
            (,, uint64 expiry) = NAME_WRAPPER.getData(uint256(node));
            if (expiry <= block.timestamp) continue;
            if (_resolve(node) != address(0)) ++count;
        }
    }

    function seatCount() external view returns (uint256) {
        return seatNodes.length;
    }

    function allSeats() external view returns (bytes32[] memory) {
        return seatNodes;
    }

    /// @notice Everything Screen 1 (org chart) needs, in a single call.
    ///         Fuses are exposed because we display them: it's the shortest
    ///         signal that we read the NameWrapper properly.
    function seatInfo(bytes32 node)
        external
        view
        returns (bool registered, address stealthAddress, uint32 fuses, uint64 expiry, bool active)
    {
        registered = isSeat[node];
        (, fuses, expiry) = NAME_WRAPPER.getData(uint256(node));
        stealthAddress = _resolve(node);
        active = registered && expiry > block.timestamp && stealthAddress != address(0);
    }

    function _resolve(bytes32 node) internal view returns (address) {
        address r = ENS.resolver(node);
        if (r == address(0)) return address(0);
        return IAddrResolver(r).addr(node);
    }

    // ——— EIP-712 ——————————————————————————————————————————————

    function domainSeparator() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                _DOMAIN_TYPEHASH,
                keccak256(bytes("GORA")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    /// @notice Exposed so the frontend can verify what it is signing.
    function executeDigest(address to, uint256 value, bytes calldata data, uint256 forNonce)
        external
        view
        returns (bytes32)
    {
        return _digest(to, value, data, forNonce);
    }

    function _digest(address to, uint256 value, bytes calldata data, uint256 forNonce)
        internal
        view
        returns (bytes32)
    {
        bytes32 structHash =
            keccak256(abi.encode(_EXECUTE_TYPEHASH, to, value, keccak256(data), forNonce));
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    // ——— execution ————————————————————————————————————————————

    /// @notice Anyone can call and pay gas. This is deliberate: a GORA stealth
    ///         address SIGNS but never emits a transaction, so it never needs
    ///         to be funded, so it is never linked to its holder. (§1 invariant)
    ///
    /// @param signatures Sorted by recovered address ASCENDING. The contract
    ///                   uses this to reject duplicates in a single pass.
    function execute(
        address to,
        uint256 value,
        bytes calldata data,
        uint256 expectedNonce,
        bytes[] calldata signatures
    ) external returns (bytes memory result) {
        if (expectedNonce != nonce) revert BadNonce();

        bytes32 digest = _digest(to, value, data, expectedNonce);

        address last; // ascending sort = anti-duplicate O(n)
        uint256 valid;
        for (uint256 i; i < signatures.length; ++i) {
            address rec = ECDSA.recover(digest, signatures[i]);
            if (rec <= last) revert DuplicateSigner(rec); // duplicate OR wrong order
            if (!isActiveSigner(rec)) revert NotASigner(rec);
            last = rec;
            ++valid;
        }
        if (valid < threshold) revert ThresholdNotMet(valid, threshold);

        ++nonce;

        bool ok;
        (ok, result) = to.call{value: value}(data);
        if (!ok) revert CallFailed();

        emit Executed(digest, to, value);
    }
}


import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {IENSRegistry} from "./interfaces/IENSRegistry.sol";
import {IAddrResolver} from "./interfaces/IAddrResolver.sol";
import {INameWrapper} from "./interfaces/INameWrapper.sol";
