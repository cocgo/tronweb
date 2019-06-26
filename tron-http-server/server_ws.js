const WebSocket = require("ws");
const axios = require("axios");

const CMC_API_TRX_ID = 1958; //https://api.coinmarketcap.com/v2/listings/
const CMC_API_URL = `https://api.coinmarketcap.com/v2/ticker/${CMC_API_TRX_ID}/?convert=USD`;
const PRICE_UPDATING_INTERVAL = 3600000;

module.exports = class{
    constructor(config){
        console.log(`Starting websocket server on port ${config.port_ws}`);
        this.lastPrice = null;
        this.connectedClients = [];

        this.wss = new WebSocket.Server({port: config.port_ws});
        this.wss.on('connection', this.onConnection.bind(this));
        this.updatePrice(true);

        this.alertMap = {};
    }

    onConnection(ws){
        console.log('client connected');
        this.sendPrice(ws);
        this.connectedClients.push(ws);
        ws.on('message', this.onMessage.bind({_this:this, ws:ws}));
    }

    onMessage(event){
        console.log(event);
        try{
            let json = JSON.parse(event);
            console.log(json.cmd);
            if(json && json.cmd === 'START_ALERT'){
                let userid = json.userid;
                let address = json.address;

                if(this._this.alertMap[address] === undefined)
                    this._this.alertMap[address] = {};
                this._this.alertMap[address][userid] = this.ws;
                console.log(`starting alert for userid ${userid} for address ${address}`);
            }
        }catch (e) {
            console.log(e);
        }
    }

    sendPrice(ws){
        ws.send(this.lastPrice);
    }

    broadcastAddressAlerts(addressList){
        for(let i = 0;i<addressList.length;i++){
            this.broadcastAddressAlert(addressList[i]);
        }
    }

    broadcastAddressAlert(address){
        if(this.alertMap[address]){
            for (let p in this.alertMap[address]) {
                if (this.alertMap[address].hasOwnProperty(p)) {
                    let ws = this.alertMap[address][p];
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            cmd : "ADDRESS_EVENT",
                            address : address
                        }));
                    }else{
                        delete this.alertMap[address][p];
                    }
                }
            }
        }
    }

    broadcastPrice(){
        console.log(`broadcasting price to ${this.connectedClients.length} clients`);
        for(let i = this.connectedClients.length -1; i>=0 ;i--){
            let ws = this.connectedClients[i];
            if (ws.readyState === WebSocket.OPEN) {
                this.sendPrice(ws);
            }else{
                this.connectedClients.splice(i, 1);
            }
        }
    }

    async updatePrice(repeat){
        console.log("fetching price");
        let price = await axios.get(CMC_API_URL).then(x => x.data);

        if(price && price.data && price.data.name === 'TRON' && price.data.last_updated > 0){
            this.lastPrice = JSON.stringify({
                symbol : price.data.symbol,
                USD : price.data.quotes.USD
            });
            this.broadcastPrice();
        }

        if(repeat){
            setTimeout(() => {this.updatePrice(repeat)}, PRICE_UPDATING_INTERVAL);
        }
    }
};