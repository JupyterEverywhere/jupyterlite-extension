import { ReactWidget } from '@jupyterlab/apputils';
import { LabIcon } from '@jupyterlab/ui-components';
import React from 'react';

export class PageTitle extends ReactWidget {
  constructor(protected props: { label: string; icon: LabIcon }) {
    super();
    this.addClass('je-PageTitle');
  }
  protected render() {
    return (
      <>
        <this.props.icon.react height="24px" />
        {this.props.label}
      </>
    );
  }
}
