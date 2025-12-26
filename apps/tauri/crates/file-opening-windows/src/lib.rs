use file_opening::{FileOpener, OpenResult, OpenWithApp};
use std::path::Path;
use windows::{
	core::*, Win32::System::Com::*, Win32::UI::Shell::*,
	Win32::UI::WindowsAndMessaging::*,
};

// Thread-local COM initialization
thread_local! {
	static COM_INITIALIZED: std::cell::RefCell<bool> = std::cell::RefCell::new(false);
}

fn ensure_com_initialized() {
	COM_INITIALIZED.with(|initialized| {
		if !*initialized.borrow() {
			unsafe {
				let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
			}
			*initialized.borrow_mut() = true;
		}
	});
}

pub struct WindowsFileOpener;

impl FileOpener for WindowsFileOpener {
	fn get_apps_for_file(&self, path: &Path) -> std::result::Result<Vec<OpenWithApp>, String> {
		ensure_com_initialized();

		let ext = path
			.extension()
			.and_then(|e| e.to_str())
			.map(|e| format!(".{}", e))
			.unwrap_or_default();

		if ext.is_empty() {
			return Ok(vec![]);
		}

		list_apps_for_extension(&ext)
	}

	fn open_with_default(&self, path: &Path) -> std::result::Result<OpenResult, String> {
		ensure_com_initialized();

		let path_str = path.to_string_lossy();
		let h_path = HSTRING::from(&*path_str);

		unsafe {
			let result = ShellExecuteW(None, w!("open"), &h_path, None, None, SW_SHOWNORMAL);

			if result.0 as i32 > 32 {
				Ok(OpenResult::Success)
			} else {
				Ok(OpenResult::PlatformError {
					message: format!("ShellExecute failed with code {:?}", result.0),
				})
			}
		}
	}

	fn open_with_app(&self, path: &Path, app_id: &str) -> std::result::Result<OpenResult, String> {
		ensure_com_initialized();

		let ext = path
			.extension()
			.and_then(|e| e.to_str())
			.map(|e| format!(".{}", e))
			.unwrap_or_default();

		if ext.is_empty() {
			return Ok(OpenResult::PlatformError {
				message: "File has no extension".to_string(),
			});
		}

		// Find handler by app_id (which is the app name on Windows)
		unsafe {
			let handlers = SHAssocEnumHandlers(&HSTRING::from(ext.as_str()), ASSOC_FILTER_RECOMMENDED)
				.map_err(|e| format!("Failed to enumerate handlers: {}", e))?;

			// Iterate over handlers using Next() method
			loop {
				let mut handler_buf = [None::<IAssocHandler>];
				let mut fetched = 0u32;
				
				match handlers.Next(&mut handler_buf, Some(&mut fetched as *mut u32)) {
					Ok(()) if fetched > 0 => {
						if let Some(handler) = handler_buf[0].take() {
							let name = handler
								.GetName()
								.map_err(|e| format!("Failed to get handler name: {}", e))?
								.to_string()
								.map_err(|e| format!("Failed to convert name to string: {}", e))?;

							if name == app_id {
								// Create shell item from file path
								let path_str = path.to_string_lossy();
								let h_path = HSTRING::from(&*path_str);

								let shell_item: IShellItem = SHCreateItemFromParsingName(&h_path, None)
									.map_err(|e| format!("Failed to create shell item: {}", e))?;

								let data_object: IDataObject = shell_item
									.BindToHandler(None, &BHID_DataObject)
									.map_err(|e| format!("Failed to bind to data object: {}", e))?;

								handler.Invoke(&data_object)
									.map_err(|e| format!("Failed to invoke handler: {}", e))?;

								return Ok(OpenResult::Success);
							}
						}
					}
					_ => break, // No more handlers or error
				}
			}

			Ok(OpenResult::AppNotFound {
				app_id: app_id.to_string(),
			})
		}
	}
}

fn list_apps_for_extension(ext: &str) -> std::result::Result<Vec<OpenWithApp>, String> {
	unsafe {
		let handlers = SHAssocEnumHandlers(&HSTRING::from(ext), ASSOC_FILTER_RECOMMENDED)
			.map_err(|e| format!("Failed to enumerate handlers: {}", e))?;

		let mut apps = Vec::new();
		
		// Iterate over handlers using Next() method
		loop {
			let mut handler_buf = [None::<IAssocHandler>];
			let mut fetched = 0u32;
			
			match handlers.Next(&mut handler_buf, Some(&mut fetched as *mut u32)) {
				Ok(()) if fetched > 0 => {
					if let Some(handler) = handler_buf[0].take() {
						let name = handler
							.GetName()
							.map_err(|e| format!("Failed to get handler name: {}", e))?
							.to_string()
							.map_err(|e| format!("Failed to convert name to string: {}", e))?;

						apps.push(OpenWithApp {
							id: name.clone(),
							name,
							icon: None,
						});
					}
				}
				_ => break, // No more handlers or error
			}
		}

		apps.sort_by(|a, b| a.name.cmp(&b.name));
		Ok(apps)
	}
}
