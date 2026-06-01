export declare const EXCHANGE_CLIENT_PLUGIN_CONFIG_KEY = "exchange-client.config";
export declare const configSymbol: unique symbol;
export interface IUniverExchangeClientConfig {
    /**
     * The URL of the endpoint for downloading files.
     * @default 'location.origin'
     */
    downloadEndpointUrl?: string;
    uploadFileServerUrl?: string;
    importServerUrl?: string;
    exportServerUrl?: string;
    getTaskServerUrl?: string;
    signUrlServerUrl?: string;
    maxTimeoutTime?: number;
}
export declare const defaultPluginConfig: IUniverExchangeClientConfig;
