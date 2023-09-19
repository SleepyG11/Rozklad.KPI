export default class CacheMap extends Map{
    constructor(ttl = 60){
        super();
        this.ttl = ttl;
        this.timeouts = new Map();
    }
    set(key, value){
        clearTimeout(this.timeouts.get(key));
        this.timeouts.set(key, setTimeout(() => {
            this.delete(key);
        }, this.ttl * 1000));
        super.set(key, value);
        return this;
    }
    delete(key){
        clearTimeout(this.timeouts.get(key));
        this.timeouts.delete(key);
        return super.delete(key);
    }
}