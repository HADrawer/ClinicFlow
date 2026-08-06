import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {PermissionEditor} from "./permission-editor";

const catalog={
  "Patients":["patients.read","patients.create"],
  "Billing & insurance":["billing.create"],
};

describe("PermissionEditor",()=>{
  afterEach(()=>cleanup());

  it("renders every permission grouped by category with human-readable labels",()=>{
    render(<PermissionEditor value={[]} onChange={vi.fn()} catalog={catalog}/>);
    expect(screen.getByText("Patients")).toBeVisible();
    expect(screen.getByText("Billing & insurance")).toBeVisible();
    expect(screen.getByLabelText("View patients")).toBeInTheDocument();
    expect(screen.getByLabelText("Create patients")).toBeInTheDocument();
    expect(screen.getByLabelText("Manage billing")).toBeInTheDocument();
  });

  it("supports selecting more than one independent permission at once", () => {
    const onChange = vi.fn();
    const {rerender} = render(
      <PermissionEditor value={[]} onChange={onChange} catalog={catalog} />,
    );
    fireEvent.click(screen.getByLabelText("View patients"));
    expect(onChange).toHaveBeenCalledWith(["patients.read"]);

    rerender(
      <PermissionEditor value={["patients.read"]} onChange={onChange} catalog={catalog} />,
    );
    fireEvent.click(screen.getByLabelText("Manage billing"));
    expect(onChange).toHaveBeenCalledWith(["patients.read", "billing.create"]);
  });

  it("unchecking a permission removes only that permission", () => {
    const onChange = vi.fn();
    render(
      <PermissionEditor
        value={["patients.read", "billing.create"]}
        onChange={onChange}
        catalog={catalog}
      />,
    );
    fireEvent.click(screen.getByLabelText("View patients"));
    expect(onChange).toHaveBeenCalledWith(["billing.create"]);
  });

  it("shows a message instead of an empty control when nothing is grantable",()=>{
    render(<PermissionEditor value={[]} onChange={vi.fn()} catalog={{}}/>);
    expect(screen.getByText(/no additional permissions are available to grant/i)).toBeVisible();
  });

  it("shows a running count of the currently selected permissions",()=>{
    const {rerender}=render(<PermissionEditor value={[]} onChange={vi.fn()} catalog={catalog}/>);
    expect(screen.getByText("0 selected")).toBeVisible();
    rerender(<PermissionEditor value={["patients.read","billing.create"]} onChange={vi.fn()} catalog={catalog}/>);
    expect(screen.getByText("2 selected")).toBeVisible();
  });
});
