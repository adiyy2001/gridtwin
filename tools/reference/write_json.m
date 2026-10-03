function write_json(path, value)
  handle = fopen(path, 'w');
  fputs(handle, jsonencode(value, 'PrettyPrint', true, 'ConvertInfAndNaN', false));
  fputs(handle, "\n");
  fclose(handle);
end
