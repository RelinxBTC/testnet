# Enable local devnet for Leather Wallet

## Quick Start

```shell
docker compose up -d
docker compose -f stacks-api.yml up -d
```

Set up some block data, so the api can work correctly

```shell
docker exec --user bitcoin bitcoind bitcoin-cli -regtest --rpcuser=devnet --rpcpassword=devnet createwallet default
docker exec --user bitcoin bitcoind bitcoin-cli -regtest --rpcuser=devnet --rpcpassword=devnet generatetoaddress 101 $(docker exec --user bitcoin bitcoind bitcoin-cli -regtest --rpcuser=devnet --rpcpassword=devnet getnewaddress)
```

Now you can switch to Devnet in your Leather wallet. A mempool explorer is also included at http://localhost:8083.

Stacks API can be stopped once you have switched to Devnet in your leather wallet.

```shell
docker compose -f stacks-api.yml stop
```

## Commands

- Generate a block

```shell
docker exec --user bitcoin bitcoind bitcoin-cli -regtest --rpcuser=devnet --rpcpassword=devnet generatetoaddress 1 $(docker exec --user bitcoin bitcoind bitcoin-cli -regtest --rpcuser=devnet --rpcpassword=devnet getnewaddress)
```

- Send testing bitcoins to an account

```shell
docker exec --user bitcoin bitcoind bitcoin-cli --regtest --rpcuser=devnet --rpcpassword=devnet -named sendtoaddress amount=10 fee_rate=1 address=<your_address>
```

- If services have been restarted, you need to reload the wallet and generate at least one block

```shell
docker exec --user bitcoin bitcoind bitcoin-cli -regtest --rpcuser=devnet --rpcpassword=devnet loadwallet default
docker exec --user bitcoin bitcoind bitcoin-cli -regtest --rpcuser=devnet --rpcpassword=devnet generatetoaddress 1 $(docker exec --user bitcoin bitcoind bitcoin-cli -regtest --rpcuser=devnet --rpcpassword=devnet getnewaddress)
```

## What's included

- A bitcoin-core that runs regtest
- An esplora api that serves at 18443, which is needed by Leather
- A blockstream electrs, db and mempool api for mempool fontend
- A mempool frontend that serves at 8083 for both UI and API
- A standalone stacks api that serves at 3999 and can be stopped at anytime, which is only used to cheat Leather to show Devnet as available.

## Q&A

### Facing an error when starting stacks-api

```shell
# docker logs -f `docker ps|grep stacks|awk -F' ' '{print $1}'`
...
ERRO [1719839407.884364] [testnet/stacks-node/src/main.rs:58] [main] Process abort due to thread panic: panicked at 'Unable to parse http://::1:18443 as a URL: EmptyHost', testnet/stacks-node/src/burnchains/bitcoin_regtest_controller.rs:2016:30
...
```

If you see this error above, you need to downgrade your DockerDesktop. Version 4.18.0 (104112) is perfect to run `stacks-api` in docker.

### How to clean the local volume data when you want a fresh restarting

```shell
# shut down your local docker containers
docker compose down
# then, check your local volumes starting with `devnet_`
docker volume ls 
...
local     devnet_bitcoin-data
local     devnet_electrs-data
local     devnet_mempool-api-cache
local     devnet_mysql-data
local     stacks_stacks-data
# delete them all
docker volume rm devnet_bitcoin-data devnet_electrs-data devnet_mempool-api-cache devnet_mysql-data stacks_stacks-data
# now, run the docker compose command
docker compose up -d
# exec the commands
docker exec --user bitcoin bitcoind bitcoin-cli -regtest --rpcuser=devnet --rpcpassword=devnet createwallet default
docker exec --user bitcoin bitcoind bitcoin-cli -regtest --rpcuser=devnet --rpcpassword=devnet generatetoaddress 101 $(docker exec --user bitcoin bitcoind bitcoin-cli -regtest --rpcuser=devnet --rpcpassword=devnet getnewaddress)
```
