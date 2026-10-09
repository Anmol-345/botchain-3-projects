/** ABIs minimales — uniquement ce que l'app appelle réellement. */
import { parseAbi, parseAbiItem } from 'viem'

export const baseRegistrarAbi = parseAbi([
  'function available(uint256 id) view returns (bool)',
  'function register(uint256 id, address owner, uint256 duration)',
  'function nameExpires(uint256 id) view returns (uint256)',
  'function setApprovalForAll(address operator, bool approved)',
])

export const vaultAbi = parseAbi([
  'function parentNode() view returns (bytes32)',
  'function threshold() view returns (uint256)',
  'function nonce() view returns (uint256)',
  'function seatCount() view returns (uint256)',
  'function allSeats() view returns (bytes32[])',
  'function seatInfo(bytes32 node) view returns (bool registered, address stealthAddress, uint32 fuses, uint64 expiry, bool active)',
  'function isActiveSigner(address who) view returns (bool)',
  'function activeSignerCount() view returns (uint256)',
  'function executeDigest(address to, uint256 value, bytes data, uint256 forNonce) view returns (bytes32)',
  'function assignSeat(bytes32 node, bytes ephemeralPubKey, uint8 viewTag)',
  'function removeSeat(bytes32 node)',
  'function execute(address to, uint256 value, bytes data, uint256 expectedNonce, bytes[] signatures) returns (bytes)',
  'function emergencyQueuedAt() view returns (uint256)',
  'function EMERGENCY_DELAY() view returns (uint256)',
  'function emergencyQueue()',
  'function emergencyWithdraw()',
  'function emergencyCancel()',
])

export const seatAssignedEvent = parseAbiItem(
  'event SeatAssigned(bytes32 indexed node, address indexed stealthAddress, bytes ephemeralPubKey, uint8 viewTag)',
)

export const registryAbi = parseAbi(['function resolver(bytes32 node) view returns (address)'])

export const resolverAbi = parseAbi([
  'function addr(bytes32 node) view returns (address)',
  'function setAddr(bytes32 node, address a)',
  'function text(bytes32 node, string key) view returns (string)',
  'function setText(bytes32 node, string key, string value)',
])

export const wrapperAbi = parseAbi([
  'function getData(uint256 id) view returns (address owner, uint32 fuses, uint64 expiry)',
  'function ownerOf(uint256 id) view returns (address)',
  'function setSubnodeRecord(bytes32 parentNode, string label, address owner, address resolver, uint64 ttl, uint32 fuses, uint64 expiry) returns (bytes32)',
  'function wrapETH2LD(string label, address wrappedOwner, uint16 ownerControlledFuses, address resolver) returns (uint64 expiry)',
])
