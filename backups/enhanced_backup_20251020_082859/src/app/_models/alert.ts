export class Alert {
    id?: string;
    type?: AlertType;
    message?: string;
    autoClose?: boolean;
    keepAfterRouteChange?: boolean;
    fade?: boolean;
    buttons?: AlertButton[];

    constructor(init?: Partial<Alert>) {
        Object.assign(this, init);
    }
}

export interface AlertButton {
    text: string;
    action: () => void;
    cssClass?: string;
}

export enum AlertType {
    Success,
    Error,
    Info,
    Warning
}

export class AlertOptions {
    id?: string;
    autoClose?: boolean;
    keepAfterRouteChange?: boolean;
    buttons?: AlertButton[];
}