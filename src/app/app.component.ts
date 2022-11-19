import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ServerService } from './service/server.service';
import {
  BehaviorSubject,
  catchError,
  map,
  Observable,
  of,
  startWith,
} from 'rxjs';
import { CustomResponse } from './enum/custom-response';
import { AppState } from './interface/app-state';
import { DataState } from './enum/data-state.enum';
import { Status } from './enum/status.enum';
import { Server } from './interface/server';
import { NgForm } from '@angular/forms';
import { NotificationsService } from './service/notifications.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {
  appState$!: Observable<AppState<CustomResponse>>;

  readonly DataState = DataState;
  readonly Status = Status;
  private filterSubject = new BehaviorSubject<string>('');
  private dataSubject = new BehaviorSubject<CustomResponse | undefined>(
    undefined
  );
  filterStatus$ = this.filterSubject.asObservable();
  private isLoading = new BehaviorSubject<boolean>(
    false
  );
  isLoading$ = this.isLoading.asObservable();
  ngSelect = 'Print13';

  constructor(private serverService: ServerService, private notifier: NotificationsService) {}

  ngOnInit(): void {
    this.appState$ = this.serverService.servers$.pipe(
      map((response) => {
        this.dataSubject.next(response);
        return {
          dataState: DataState.LOADED_STATE,
          appData: { ...response, data: {
            servers: response.data?.servers?.reverse()
          }},
        };
      }),
      startWith({
        dataState: DataState.LOADING_STATE,
      }),
      catchError((error: string) => {
        this.notifier.onError(error);
        return of({
          dataState: DataState.ERROR_STATE,
          error,
        });
      })
    );
  }

  pingServer(ipAddress: string): void {
    this.filterSubject.next(ipAddress);
    this.appState$ = this.serverService.ping$(ipAddress).pipe(
      map((response) => {
        const index = (
          this.dataSubject.value?.data?.servers as Server[]
        ).findIndex((srv) => srv.id === (response.data?.server as Server).id);

        (this.dataSubject.value?.data?.servers as Server[])[index] = response
          .data?.server as Server;
          this.notifier.onDefault(response.message);
        this.filterSubject.next('');
        return {
          dataState: DataState.LOADED_STATE,
          appData: this.dataSubject.value,
        };
      }),
      startWith({
        dataState: DataState.LOADED_STATE,
        appData: this.dataSubject.value,
      }),
      catchError((error: string) => {
        this.notifier.onError(error);
        this.filterSubject.next('');
        return of({
          dataState: DataState.ERROR_STATE,
          error,
        });
      })
    );
  }

  saveServer(serverForm: NgForm): void {
    this.isLoading.next(true);
    this.appState$ = this.serverService.save$(<Server>serverForm.value).pipe(
      map((response) => {
        this.dataSubject.next(
          {...response, data: {
            servers: [ <Server>response.data?.server, ...(<Server[]>this.dataSubject?.value?.data?.servers)]
          }}
        );
        this.notifier.onSuccess(response.message);
        document.getElementById('closeModal')?.click();
        this.isLoading.next(false);
        serverForm.resetForm({ status: this.Status.SERVER_DOWN })
        return {
          dataState: DataState.LOADED_STATE,
          appData: this.dataSubject.value,
        };
      }),
      startWith({
        dataState: DataState.LOADED_STATE,
        appData: this.dataSubject.value,
      }),
      catchError((error: string) => {
        this.notifier.onError(error);
        this.isLoading.next(false);
        return of({
          dataState: DataState.ERROR_STATE,
          error,
        });
      })
    );
  }

  filterServers(status: Status | string): void {
    this.appState$ = this.serverService.filter$(status, this.dataSubject.value!).pipe(
      map((response) => {
        this.notifier.onDefault(response.message);
        return {
          dataState: DataState.LOADED_STATE,
          appData: response,
        };
      }),
      startWith({
        dataState: DataState.LOADED_STATE,
        appData: this.dataSubject.value,
      }),
      catchError((error: string) => {
        this.notifier.onError(error);
        return of({
          dataState: DataState.ERROR_STATE,
          error,
        });
      })
    );
  }

  deleteServer(server: Server): void {
    this.appState$ = this.serverService.delete$(server.id).pipe(
      map((response) => {
        this.dataSubject.next(
          {
            ...response,
            data: {
              servers: this.dataSubject.value?.data?.servers?.filter(srv => srv.id !== server.id)
            }
          }
        );
        this.notifier.onSuccess(response.message);
        return {
          dataState: DataState.LOADED_STATE,
          appData: this.dataSubject.value,
        };
      }),
      startWith({
        dataState: DataState.LOADED_STATE,
        appData: this.dataSubject.value,
      }),
      catchError((error: string) => {
        this.notifier.onError(error);
        return of({
          dataState: DataState.ERROR_STATE,
          error,
        });
      })
    );
  }

  printReport(format: string): void {
    if (format === DocumentFormat.PDF) {
      window.print();
    } else if (format === DocumentFormat.EXCEL) {
      const dataType = 'application/vnd.ms-excel.sheet.macroEnabled.12';
  
      const selectedTable = document.getElementById('servers-table')?.outerHTML.replace(/ /g, '%20');
  
      const downloadLink = document.createElement('a');
      downloadLink.href = 'data:' + dataType + ', ' + selectedTable;
      downloadLink.download = 'server-report.xls';
  
      document.body.appendChild(downloadLink);
  
      downloadLink.click();
  
      format = DocumentFormat.DEFAULT;
      document.body.removeChild(downloadLink);
    }
  }
}

enum DocumentFormat {
  EXCEL = 'excel',
  PDF = 'pdf',
  DEFAULT = ''
}