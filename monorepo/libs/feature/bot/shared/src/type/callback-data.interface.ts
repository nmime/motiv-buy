/**
 * Callback Data Interface
 * 
 * Defines the structure for callback query data from inline keyboards.
 * Handles action routing and parameter passing in bot interactions.
 * 
 * @interface CallbackData
 */
export interface CallbackData {
  /** Action identifier */
  action: string;
  
  /** Action parameters */
  params?: string[];
  
  /** Additional metadata */
  metadata?: Record<string, any>;
  
  /** Callback timestamp */
  timestamp?: number;
}

/**
 * Menu Callback Data Interface
 * 
 * Specific callback data structure for menu-related actions.
 */
export interface MenuCallbackData extends CallbackData {
  /** Target menu identifier */
  menuId?: string;
  
  /** Menu action type */
  menuAction?: MenuActionType;
  
  /** Navigation direction */
  direction?: NavigationDirection;
}

/**
 * Form Callback Data Interface
 * 
 * Callback data structure for form-related interactions.
 */
export interface FormCallbackData extends CallbackData {
  /** Form identifier */
  formId: string;
  
  /** Field identifier */
  fieldId?: string;
  
  /** Form action type */
  formAction: FormActionType;
  
  /** Field value */
  value?: string;
}

/**
 * Pagination Callback Data Interface
 * 
 * Callback data for pagination controls.
 */
export interface PaginationCallbackData extends CallbackData {
  /** Current page number */
  page: number;
  
  /** Items per page */
  limit: number;
  
  /** Total items count */
  total?: number;
  
  /** Pagination action */
  paginationAction: PaginationActionType;
}

/**
 * Menu Action Type Enum
 */
export enum MenuActionType {
  Navigate = 'navigate',
  Select = 'select',
  Toggle = 'toggle',
  Delete = 'delete',
  Edit = 'edit',
  Create = 'create',
}

/**
 * Navigation Direction Enum
 */
export enum NavigationDirection {
  Forward = 'forward',
  Back = 'back',
  Home = 'home',
  Up = 'up',
}

/**
 * Form Action Type Enum
 */
export enum FormActionType {
  Submit = 'submit',
  Cancel = 'cancel',
  Reset = 'reset',
  Save = 'save',
  Next = 'next',
  Previous = 'previous',
  UpdateField = 'update_field',
}

/**
 * Pagination Action Type Enum
 */
export enum PaginationActionType {
  First = 'first',
  Previous = 'previous',
  Next = 'next',
  Last = 'last',
  GoTo = 'goto',
}

/**
 * Callback Data Builder Interface
 * 
 * Utility interface for building callback data strings.
 */
export interface CallbackDataBuilder {
  /** Build callback data string from object */
  build(data: CallbackData): string;
  
  /** Parse callback data string to object */
  parse(callbackString: string): CallbackData;
  
  /** Validate callback data structure */
  validate(data: CallbackData): boolean;
}