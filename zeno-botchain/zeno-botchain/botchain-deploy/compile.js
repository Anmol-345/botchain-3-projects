const fs = require('fs');
const solc = require('solc');

const source = fs.readFileSync('ZenoPayment.sol', 'utf8');
const input = {
  language: 'Solidity',
  sources: {
    'ZenoPayment.sol': { content: source }
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const contract = output.contracts['ZenoPayment.sol'].ZenoPayment;

if (contract.evm.bytecode.object.length === 0) {
  console.error('Compilation errors:', output.errors);
  process.exit(1);
}

fs.writeFileSync('ZenoPayment.abi', JSON.stringify(contract.abi, null, 2));
fs.writeFileSync('ZenoPayment.bin', '0x' + contract.evm.bytecode.object);
console.log('Compiled ZenoPayment.sol');
console.log('Bytecode size:', contract.evm.bytecode.object.length / 2, 'bytes');
