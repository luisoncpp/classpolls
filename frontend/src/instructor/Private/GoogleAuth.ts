declare const google: {
  accounts: {
    id: {
      initialize(config: { callback: (response: { credential: string }) => void; client_id: string }): void;
      renderButton(element: HTMLElement, options: { size: string; theme: string }): void;
    };
  };
};

export class GoogleAuth {
  private initialized = false;

  constructor(
    private clientId: string,
    private onCredential: (jwt: string) => void
  ) {}

  public mountButton(element: HTMLElement): void {
    if (!this.initialized) {
      google.accounts.id.initialize({
        callback: (response) => this.onCredential(response.credential),
        client_id: this.clientId
      });
      this.initialized = true;
    }
    element.replaceChildren();
    google.accounts.id.renderButton(element, { size: 'large', theme: 'outline' });
  }
}
