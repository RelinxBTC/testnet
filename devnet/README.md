# Enable local devnet for Leather Wallet

## Quick Start

```
docker compose up -d
docker compose -f stacks-api.yml up -d
```

Set up some block data, so the api can work correctly

```
docker exec --user bitcoin bitcoind bitcoin-cli -regtest --rpcuser=devnet --rpcpassword=devnet createwallet default
docker exec --user bitcoin bitcoind bitcoin-cli -regtest --rpcuser=devnet --rpcpassword=devnet generatetoaddress 101 $(docker exec --user bitcoin bitcoind bitcoin-cli -regtest --rpcuser=devnet --rpcpassword=devnet getnewaddress)
```

Now you can switch to Devnet in your Leather wallet. A mempool explorer is also included at http://localhost:8083.

Stacks API can be stopped once you have switched to Devnet in your leather wallet.

```
docker compose -f stacks-api.yml stop
```

## Commands

- Generate a block

```
docker exec --user bitcoin bitcoind bitcoin-cli -regtest --rpcuser=devnet --rpcpassword=devnet generatetoaddress 1 $(docker exec --user bitcoin bitcoind bitcoin-cli -regtest --rpcuser=devnet --rpcpassword=devnet getnewaddress)
```

- Send testing bitcoins to an account

```
docker exec --user bitcoin bitcoind bitcoin-cli --regtest --rpcuser=devnet --rpcpassword=devnet -named sendtoaddress amount=100 fee_rate=1 address=<your_address>
```

- If services have been restarted, you need to reload the wallet and generate at least one block

```
docker exec --user bitcoin bitcoind bitcoin-cli -regtest --rpcuser=devnet --rpcpassword=devnet loadwallet default
docker exec --user bitcoin bitcoind bitcoin-cli -regtest --rpcuser=devnet --rpcpassword=devnet generatetoaddress 1 $(docker exec --user bitcoin bitcoind bitcoin-cli -regtest --rpcuser=devnet --rpcpassword=devnet getnewaddress)
```

## What's included

- A bitcoin-core that runs regtest
- An esplora api that serves at 18443, which is needed by Leather
- A blockstream electrs, db and mempool api for mempool fontend
- A mempool frontend that serves at 8083 for both UI and API
- A standalone stacks api that serves at 3999 and can be stopped at anytime, which is only used to cheat Leather to show Devnet as available.
